import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestApp, closeTestApp, seedFixture, cleanup } from './helpers.js';

let fixture: Awaited<ReturnType<typeof seedFixture>>;

beforeAll(async () => {
  await getTestApp();
  fixture = await seedFixture(2);
});

afterAll(async () => {
  await fixture?.cleanup();
  await closeTestApp();
});

async function api(token: string, method: 'GET' | 'POST' | 'PATCH', url: string, payload?: unknown) {
  const app = await getTestApp();
  return app.inject({
    method,
    url: `/api/v1${url}`,
    headers: { authorization: `Bearer ${token}` },
    payload,
  });
}

describe('Mandatory E2E scenario (runbook §7)', () => {
  let caseId = '';
  let employee1Token = '';
  let employee2Token = '';

  it('1-2. system admin login works and admin can create a company + manager', async () => {
    const app = await getTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/admin/login',
      payload: { username: 'admin', password: 'admin1234' },
    });
    expect(res.statusCode).toBe(200);
    const adminToken = res.json().token;

    const uniqueMobile = `0914${String(Date.now()).slice(-7)}`;
    const companyName = `شرکت سناریو ${Date.now()}`;
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/companies',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: companyName,
        manager: {
          firstName: 'سینا',
          lastName: 'مدیرسناریو',
          mobile: uniqueMobile,
          password: 'Manager!234',
        },
      },
    });
    expect(created.statusCode).toBe(200);

    // new manager can log in immediately
    const mgrLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { mobile: uniqueMobile, password: 'Manager!234' },
    });
    expect(mgrLogin.statusCode).toBe(200);
    expect(mgrLogin.json().user.role).toBe('COMPANY_MANAGER');

    // verify company shows up for admin, then remove it again
    const companies = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/companies',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const target = companies
      .json()
      .items.find((c: { name: string }) => c.name === companyName);
    expect(target).toBeDefined();
    const { prisma } = await import('../src/lib/prisma.js');
    await prisma.company.delete({ where: { id: target.id } });
    await prisma.user.delete({ where: { mobile: uniqueMobile } });
  });

  it('3-4. manager creates an OTP-less employee who then logs in', async () => {
    const created = await api(fixture.manager.token, 'POST', '/members', {
      firstName: 'بهنام',
      lastName: 'کارمندجدید',
      mobile: '09154445566',
      role: 'EMPLOYEE',
      password: 'Employee!234',
    });
    expect(created.statusCode).toBe(200);

    const app = await getTestApp();
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { mobile: '09154445566', password: 'Employee!234' },
    });
    expect(loginRes.statusCode).toBe(200);
  });

  it('5. manager creates a case assigned to employee 1', async () => {
    const [e1] = fixture.employees;
    employee1Token = e1.token;
    employee2Token = fixture.employees[1].token;

    const res = await api(fixture.manager.token, 'POST', '/cases', {
      title: 'پیگیری پرداخت فاکتور شماره ۱۲۳',
      description: 'فاکتور ۳۰ روز گذشته و باید پیگیری شود.',
      priority: 'HIGH',
      assignToUserId: e1.id,
    });
    expect(res.statusCode).toBe(200);
    caseId = res.json().case.id;
    expect(res.json().case.status).toBe('WAITING_ACCEPTANCE');
  });

  it('6. employee sees pending assignment and accepts', async () => {
    const pending = await api(employee1Token, 'GET', '/assignments/pending');
    expect(pending.statusCode).toBe(200);
    expect(pending.json().items.some((a: { case: { id: string } }) => a.case.id === caseId)).toBe(true);

    const accept = await api(employee1Token, 'POST', `/cases/${caseId}/accept`);
    expect(accept.statusCode).toBe(200);
    expect(accept.json().case.status).toBe('IN_PROGRESS');
    expect(accept.json().case.currentOwnerId).toBe(fixture.employees[0].id);
  });

  it('7. employee starts work; duration is measured server-side', async () => {
    const start = await api(employee1Token, 'POST', '/work-sessions/start', { caseId });
    expect(start.statusCode).toBe(200);

    // parallel work on another case must be allowed (spec §15)
    const other = await api(employee1Token, 'POST', '/cases', { title: 'پرونده دوم برای تست موازی' });
    expect(other.statusCode).toBe(200);
    const otherId = other.json().case.id;
    const startOther = await api(employee1Token, 'POST', '/work-sessions/start', { caseId: otherId });
    expect(startOther.statusCode).toBe(200);

    // duplicate session on same case rejected
    const dup = await api(employee1Token, 'POST', '/work-sessions/start', { caseId });
    expect(dup.statusCode).toBe(409);

    const end = await api(employee1Token, 'POST', '/work-sessions/end', { caseId: otherId });
    expect(end.statusCode).toBe(200);
    expect(end.json().durationSeconds).toBeGreaterThanOrEqual(0);
  });

  it('8. employee transfers the case to employee 2', async () => {
    const transfer = await api(employee1Token, 'POST', `/cases/${caseId}/transfer`, {
      toUserId: fixture.employees[1].id,
      note: 'مرخصی رفتم، لطفاً ادامه بده',
    });
    expect(transfer.statusCode).toBe(200);

    // ownership cleared while waiting
    const view = await api(fixture.manager.token, 'GET', `/cases/${caseId}`);
    expect(view.json().status).toBe('WAITING_ACCEPTANCE');
  });

  it('9. second employee accepts the transferred case', async () => {
    const accept = await api(employee2Token, 'POST', `/cases/${caseId}/accept`);
    expect(accept.statusCode).toBe(200);
    expect(accept.json().case.currentOwnerId).toBe(fixture.employees[1].id);
  });

  it('10. reject flow returns the case to sender with mandatory reason', async () => {
    // e2 transfers back to e1
    const transfer = await api(employee2Token, 'POST', `/cases/${caseId}/transfer`, {
      toUserId: fixture.employees[0].id,
    });
    expect(transfer.statusCode).toBe(200);
    // e1 rejects
    const noReason = await api(employee1Token, 'POST', `/cases/${caseId}/reject`, {});
    expect(noReason.statusCode).toBe(400);
    const reject = await api(employee1Token, 'POST', `/cases/${caseId}/reject`, {
      reason: 'دسترسی به فایل‌های مالی ندارم',
    });
    expect(reject.statusCode).toBe(200);
    const view = await api(fixture.manager.token, 'GET', `/cases/${caseId}`);
    expect(view.json().currentOwnerId).toBe(fixture.employees[1].id);
  });

  it('11. assignment history & timeline stay complete and immutable', async () => {
    const history = await api(employee1Token, 'GET', `/cases/${caseId}/assignments`);
    expect(history.statusCode).toBe(200);
    const reasons = history.json().items.map((a: { reason: string }) => a.reason);
    expect(reasons).toEqual(['INITIAL_ASSIGNMENT', 'TRANSFER', 'TRANSFER', 'RETURN_AFTER_REJECT']);

    const acts = await api(employee1Token, 'GET', `/cases/${caseId}/activities`);
    const types = acts.json().map((a: { type: string }) => a.type);
    expect(types).toContain('CREATE');
    expect(types).toContain('ASSIGN');
    expect(types).toContain('ACCEPT');
    expect(types).toContain('REJECT');

    // no delete endpoints exist for activities/assignments — verify via route 404
    const app = await getTestApp();
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/cases/${caseId}/activities/some-id`,
      headers: { authorization: `Bearer ${fixture.manager.token}` },
    });
    expect(del.statusCode).toBe(404);
  });

  it('12. result registration completes the case and manager report reflects data', async () => {
    const result = await api(employee2Token, 'POST', `/cases/${caseId}/result`, {
      result: 'پرداخت با تأخیر انجام شد؛ مشتری وعده ۵ روزه داد.',
      complete: true,
    });
    expect(result.statusCode).toBe(200);
    expect(result.json().case.status).toBe('DONE');

    const report = await api(fixture.manager.token, 'GET', '/reports/employees');
    expect(report.statusCode).toBe(200);
    const rows = report.json().items;
    const e2row = rows.find(
      (r: { user: { id: string } }) => r.user.id === fixture.employees[1].id,
    );
    expect(e2row.completedCases).toBeGreaterThanOrEqual(1);
  });

  it('13. reminder lifecycle works on an open case and closed cases reject new reminders', async () => {
    const closedReminder = await api(employee2Token, 'POST', '/reminders', {
      caseId,
      remindAt: new Date(Date.now() + 60_000).toISOString(),
      note: 'نباید روی پرونده بسته ساخته شود',
    });
    expect(closedReminder.statusCode).toBe(409);

    const reminderCase = await api(employee2Token, 'POST', '/cases', {
      title: 'پرونده مستقل برای تست یادآوری',
    });
    expect(reminderCase.statusCode).toBe(200);
    const reminderCaseId = reminderCase.json().case.id;

    const dueTime = new Date(Date.now() - 30_000).toISOString();
    const created = await api(employee2Token, 'POST', '/reminders', {
      caseId: reminderCaseId,
      remindAt: dueTime,
      note: 'چک کردن واریز',
    });
    expect(created.statusCode).toBe(200);
    const reminderId = created.json().reminder.id;

    const duplicate = await api(employee2Token, 'POST', '/reminders', {
      caseId: reminderCaseId,
      remindAt: new Date(Date.now() + 120_000).toISOString(),
      note: 'یادآوری دوم نباید پذیرفته شود',
    });
    expect(duplicate.statusCode).toBe(409);

    const dueCheck = await api(employee2Token, 'GET', '/reminders/due-check');
    expect(dueCheck.statusCode).toBe(200);
    expect(dueCheck.json().dueCount).toBeGreaterThanOrEqual(1);

    const notifs = await api(employee2Token, 'GET', '/notifications?unread=true');
    expect(notifs.statusCode).toBe(200);
    expect(
      notifs
        .json()
        .items.some((n: { type: string; linkId?: string }) => n.type === 'REMINDER_DUE' && n.linkId === reminderId),
    ).toBe(true);

    const done = await api(employee2Token, 'POST', `/reminders/${reminderId}/complete`, {
      result: 'واریز انجام شد',
    });
    expect(done.statusCode).toBe(200);

    const list = await api(employee2Token, 'GET', '/reminders?status=ACTIVE');
    expect(list.json().items.some((r: { id: string }) => r.id === reminderId)).toBe(false);
  });
});
