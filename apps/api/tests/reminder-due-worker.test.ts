import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestApp, closeTestApp, seedFixture } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';
import { createReminderDueWorker } from '../src/modules/reminders/reminder-due-worker.js';
import { claimReminderForNotification } from '../src/modules/reminders/reminder-claim.js';

let fixture: Awaited<ReturnType<typeof seedFixture>>;

beforeAll(async () => {
  await getTestApp();
  fixture = await seedFixture(2);
});

afterAll(async () => {
  await fixture?.cleanup();
  await closeTestApp();
});

async function api(
  token: string,
  method: 'GET' | 'POST' | 'PATCH',
  url: string,
  payload?: unknown,
) {
  const app = await getTestApp();
  return app.inject({
    method,
    url: `/api/v1${url}`,
    headers: { authorization: `Bearer ${token}` },
    payload,
  });
}

async function createOpenCase(token: string, title: string) {
  const res = await api(token, 'POST', '/cases', { title });
  expect(res.statusCode).toBe(200);
  return res.json().case.id as string;
}

async function createDueReminder(
  token: string,
  caseId: string,
  note: string,
  pastMs = 60_000,
) {
  const created = await api(token, 'POST', '/reminders', {
    caseId,
    remindAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    note,
  });
  expect(created.statusCode).toBe(200);
  const reminderId = created.json().reminder.id as string;
  await prisma.reminder.update({
    where: { id: reminderId },
    data: { remindAt: new Date(Date.now() - pastMs) },
  });
  return reminderId;
}

describe('Reminder datetime validation (mobile non-Z regression)', () => {
  it('rejects local ISO without trailing Z on POST /reminders', async () => {
    const employee = fixture.employees[0];
    const caseId = await createOpenCase(employee.token, 'پرونده تست رشته بدون Z');
    const localIso = new Date(Date.now() + 60 * 60 * 1000)
      .toISOString()
      .replace('Z', '');

    const res = await api(employee.token, 'POST', '/reminders', {
      caseId,
      remindAt: localIso,
      note: 'بدون Z',
    });
    expect(res.statusCode).toBe(400);
  });

  it('accepts UTC ISO with trailing Z on POST /reminders', async () => {
    const employee = fixture.employees[0];
    const caseId = await createOpenCase(employee.token, 'پرونده تست رشته با Z');
    const utcIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const res = await api(employee.token, 'POST', '/reminders', {
      caseId,
      remindAt: utcIso,
      note: 'با Z',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().reminder.status).toBe('ACTIVE');
  });

  it('rejects local ISO without trailing Z on case result nextReminder', async () => {
    const employee = fixture.employees[0];
    const caseId = await createOpenCase(employee.token, 'پرونده نتیجه بدون Z');
    const localIso = new Date(Date.now() + 2 * 60 * 60 * 1000)
      .toISOString()
      .replace('Z', '');

    const res = await api(employee.token, 'POST', `/cases/${caseId}/result`, {
      result: 'نتیجه آزمایشی',
      complete: false,
      effortMinutes: 5,
      nextReminder: { remindAt: localIso },
    });
    expect(res.statusCode).toBe(400);
  });

  it('accepts UTC ISO with trailing Z on case result nextReminder', async () => {
    const employee = fixture.employees[0];
    const caseId = await createOpenCase(employee.token, 'پرونده نتیجه با Z');
    const utcIso = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const res = await api(employee.token, 'POST', `/cases/${caseId}/result`, {
      result: 'نتیجه آزمایشی',
      complete: false,
      effortMinutes: 5,
      nextReminder: { remindAt: utcIso, note: 'پیگیری بعدی' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().message).toBe('نتیجه و یادآوری بعدی ثبت شد');
  });
});

describe('Closed-case guard on addResult', () => {
  it('rejects result on CANCELLED case', async () => {
    const managerToken = fixture.manager.token;
    const caseId = await createOpenCase(managerToken, 'پرونده لغو برای نتیجه');
    const cancel = await api(managerToken, 'POST', `/cases/${caseId}/cancel`);
    expect(cancel.statusCode).toBe(200);

    const res = await api(managerToken, 'POST', `/cases/${caseId}/result`, {
      result: 'نباید ثبت شود',
      complete: false,
      effortMinutes: 5,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().message).toContain('لغو شده');
  });

  it('still rejects result on DONE case', async () => {
    const employee = fixture.employees[0];
    const caseId = await createOpenCase(employee.token, 'پرونده تکمیل برای نتیجه مجدد');
    const complete = await api(employee.token, 'POST', `/cases/${caseId}/result`, {
      result: 'تکمیل شد',
      complete: true,
    });
    expect(complete.statusCode).toBe(200);

    const res = await api(employee.token, 'POST', `/cases/${caseId}/result`, {
      result: 'دوباره',
      complete: false,
      effortMinutes: 1,
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('Atomic claim and due-check idempotency', () => {
  it('claim flips notifiedAt only once', async () => {
    const employee = fixture.employees[0];
    const caseId = await createOpenCase(employee.token, 'پرونده ادعای اتمی');
    const created = await api(employee.token, 'POST', '/reminders', {
      caseId,
      remindAt: new Date(Date.now() + 60 * 1000).toISOString(),
      note: 'ادعا',
    });
    expect(created.statusCode).toBe(200);
    const reminderId = created.json().reminder.id as string;

    const first = await claimReminderForNotification(prisma, reminderId);
    const second = await claimReminderForNotification(prisma, reminderId);
    expect(first).toBe(true);
    expect(second).toBe(false);

    const row = await prisma.reminder.findUniqueOrThrow({ where: { id: reminderId } });
    expect(row.notifiedAt).not.toBeNull();
  });

  it('due-check is idempotent and returns notifiedCount', async () => {
    const employee = fixture.employees[1];
    const caseId = await createOpenCase(employee.token, 'پرونده بررسی سررسید');
    const reminderId = await createDueReminder(
      employee.token,
      caseId,
      'سررسید',
      30_000,
    );

    const first = await api(employee.token, 'GET', '/reminders/due-check');
    expect(first.statusCode).toBe(200);
    expect(first.json().dueCount).toBeGreaterThanOrEqual(1);
    expect(first.json().notifiedCount).toBeGreaterThanOrEqual(1);

    const second = await api(employee.token, 'GET', '/reminders/due-check');
    expect(second.statusCode).toBe(200);
    expect(second.json().notifiedCount).toBe(0);

    const notifications = await prisma.notification.findMany({
      where: { userId: employee.id, type: 'REMINDER_DUE', linkId: reminderId },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].linkType).toBe('REMINDER');
  });

  it('notifications list exposes caseId for REMINDER deep links', async () => {
    const employee = fixture.employees[1];
    const notifs = await api(employee.token, 'GET', '/notifications?limit=100');
    expect(notifs.statusCode).toBe(200);
    const reminderNotif = (notifs.json().items as Array<Record<string, unknown>>).find(
      (n) => n.type === 'REMINDER_DUE' && n.linkType === 'REMINDER',
    );
    expect(reminderNotif).toBeDefined();
    expect(typeof reminderNotif!.caseId).toBe('string');
    expect(reminderNotif!.caseId).not.toBeNull();
  });
});

describe('Reminder due worker', () => {
  it('notifies due reminders exactly once across runs', async () => {
    const employee = fixture.employees[0];
    const caseId = await createOpenCase(employee.token, 'پرونده ورکر یادآوری');
    const reminderId = await createDueReminder(
      employee.token,
      caseId,
      'ورکر',
      60_000,
    );

    const worker = createReminderDueWorker(prisma, {
      pollMs: 0,
      batchSize: 100,
      maxAgeMs: 24 * 3600 * 1000,
    });

    const first = await worker.runOnce();
    expect(first.notified).toBeGreaterThanOrEqual(1);

    const notifications = await prisma.notification.findMany({
      where: { userId: employee.id, type: 'REMINDER_DUE', linkId: reminderId },
    });
    expect(notifications).toHaveLength(1);

    const second = await worker.runOnce();
    const after = await prisma.notification.findMany({
      where: { userId: employee.id, type: 'REMINDER_DUE', linkId: reminderId },
    });
    expect(second.notified).toBe(0);
    expect(after).toHaveLength(1);
  });

  it('expires overdue reminders older than max age without notifying', async () => {
    const employee = fixture.employees[0];
    const caseId = await createOpenCase(employee.token, 'پرونده منقضی قدیمی');
    const reminderId = await createDueReminder(
      employee.token,
      caseId,
      'قدیمی',
      60_000,
    );

    await prisma.reminder.update({
      where: { id: reminderId },
      data: { remindAt: new Date(Date.now() - 25 * 3600 * 1000) },
    });

    const worker = createReminderDueWorker(prisma, {
      pollMs: 0,
      batchSize: 100,
      maxAgeMs: 24 * 3600 * 1000,
    });
    const result = await worker.runOnce();
    expect(result.expired).toBeGreaterThanOrEqual(1);

    const row = await prisma.reminder.findUniqueOrThrow({ where: { id: reminderId } });
    expect(row.status).toBe('EXPIRED');
    expect(row.notifiedAt).toBeNull();

    const notifications = await prisma.notification.findMany({
      where: { userId: employee.id, type: 'REMINDER_DUE', linkId: reminderId },
    });
    expect(notifications).toHaveLength(0);
  });

  it('expires reminders on closed cases without notifying', async () => {
    const managerToken = fixture.manager.token;
    const employee = fixture.employees[1];
    const caseId = await createOpenCase(employee.token, 'پرونده بسته با یادآوری');
    const created = await api(employee.token, 'POST', '/reminders', {
      caseId,
      remindAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      note: 'تا بسته شود',
    });
    expect(created.statusCode).toBe(200);
    const reminderId = created.json().reminder.id as string;

    const cancel = await api(managerToken, 'POST', `/cases/${caseId}/cancel`);
    expect(cancel.statusCode).toBe(200);

    const worker = createReminderDueWorker(prisma, {
      pollMs: 0,
      batchSize: 100,
      maxAgeMs: 24 * 3600 * 1000,
    });
    await worker.runOnce();

    const row = await prisma.reminder.findUniqueOrThrow({ where: { id: reminderId } });
    expect(row.status).toBe('EXPIRED');
    expect(row.notifiedAt).toBeNull();

    const notifications = await prisma.notification.findMany({
      where: { userId: employee.id, type: 'REMINDER_DUE', linkId: reminderId },
    });
    expect(notifications).toHaveLength(0);
  });

  it('does not notify future reminders', async () => {
    const employee = fixture.employees[0];
    const caseId = await createOpenCase(employee.token, 'پرونده آینده ورکر');
    const created = await api(employee.token, 'POST', '/reminders', {
      caseId,
      remindAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      note: 'آینده',
    });
    expect(created.statusCode).toBe(200);
    const reminderId = created.json().reminder.id as string;

    const worker = createReminderDueWorker(prisma, {
      pollMs: 0,
      batchSize: 100,
      maxAgeMs: 24 * 3600 * 1000,
    });
    await worker.runOnce();

    const row = await prisma.reminder.findUniqueOrThrow({ where: { id: reminderId } });
    expect(row.status).toBe('ACTIVE');
    expect(row.notifiedAt).toBeNull();
  });
});
