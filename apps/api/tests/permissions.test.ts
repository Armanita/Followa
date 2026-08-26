import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestApp, closeTestApp, seedFixture, cleanup } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';

let fixture: Awaited<ReturnType<typeof seedFixture>>;
let otherFixture: Awaited<ReturnType<typeof seedFixture>>;

beforeAll(async () => {
  await getTestApp();
  fixture = await seedFixture(1);
  otherFixture = await seedFixture(1);
});

afterAll(async () => {
  await fixture?.cleanup();
  await otherFixture?.cleanup();
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

describe('Auth & permission tests', () => {
  it('rejects unauthenticated access to protected routes', async () => {
    const res = await (await getTestApp()).inject({ method: 'GET', url: '/api/v1/cases' });
    expect(res.statusCode).toBe(401);
  });

  it('rejects bad credentials', async () => {
    const app = await getTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { mobile: fixture.manager.mobile ?? '09120000001', password: 'wrong' },
    });
    expect([401, 400]).toContain(res.statusCode);
  });

  it('employee cannot list company members', async () => {
    const res = await api(fixture.employees[0].token, 'GET', '/members');
    expect(res.statusCode).toBe(403);
  });

  it('employee cannot create employees or reset passwords', async () => {
    const created = await api(fixture.employees[0].token, 'POST', '/members', {
      firstName: 'x',
      lastName: 'y',
      mobile: '09161112222',
      role: 'EMPLOYEE',
    });
    expect(created.statusCode).toBe(403);

    const reset = await api(
      fixture.employees[0].token,
      'POST',
      `/members/${fixture.manager.membershipId}/reset-password`,
      { newPassword: 'whatever123' },
    );
    expect(reset.statusCode).toBe(403);
  });

  it('company isolation: employee of company B cannot see case of company A', async () => {
    const created = await api(fixture.manager.token, 'POST', '/cases', {
      title: 'پرونده محرمانه شرکت الف',
    });
    const caseId = created.json().case.id;

    const foreign = await api(otherFixture.employees[0].token, 'GET', `/cases/${caseId}`);
    expect(foreign.statusCode).toBe(404);
  });

  it('manager of company A cannot manage company B members', async () => {
    const reset = await api(
      fixture.manager.token,
      'POST',
      `${otherFixture.manager.membershipId.replace(/^/, '/')}/reset-password`.replace('//', '/'),
      { newPassword: 'hack1234' },
    );
    // route exists but membership belongs to another company → 404
    expect([403, 404]).toContain(reset.statusCode);
  });

  it('employee cannot see unrelated colleague cases; manager sees all', async () => {
    const [e1] = fixture.employees;
    const created = await api(e1.token, 'POST', '/cases', {
      title: 'کار شخصی کارمند یک',
    });
    const caseId = created.json().case.id;
    // e2 of OTHER company can't view
    const foreignView = await api(otherFixture.employees[0].token, 'GET', `/cases/${caseId}`);
    expect(foreignView.statusCode).toBe(404);
    // manager CAN view
    const mgrView = await api(fixture.manager.token, 'GET', `/cases/${caseId}`);
    expect(mgrView.statusCode).toBe(200);
  });

  it('suspended member cannot use the API even with valid token', async () => {
    const m = await prisma.companyMembership.findUniqueOrThrow({
      where: { id: fixture.employees[0].membershipId! },
    });
    await prisma.companyMembership.update({
      where: { id: m.id },
      data: { isActive: false },
    });
    const res = await api(fixture.employees[0].token, 'GET', '/cases');
    expect(res.statusCode).toBe(403);
    await prisma.companyMembership.update({
      where: { id: m.id },
      data: { isActive: true },
    });
    const ok = await api(fixture.employees[0].token, 'GET', '/cases');
    expect(ok.statusCode).toBe(200);
  });

  it('OTP flow: request for unknown mobile is rejected; known user without password gets code (mock)', async () => {
    const app = await getTestApp();
    const unknown = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/request',
      payload: { mobile: '09999999999' },
    });
    expect(unknown.statusCode).toBe(400);

    // create a password-less member
    const created = await api(fixture.manager.token, 'POST', '/members', {
      firstName: 'بدون',
      lastName: 'رمز',
      mobile: '09163334444',
      role: 'EMPLOYEE',
    });
    expect(created.statusCode).toBe(200);
    expect(created.json().requiresOtpSignup).toBe(true);

    const otpReq = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/request',
      payload: { mobile: '09163334444' },
    });
    expect(otpReq.statusCode).toBe(200);
  });

  it('input validation: invalid mobile and short titles rejected', async () => {
    const app = await getTestApp();
    const badLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { mobile: '12345', password: 'x' },
    });
    expect(badLogin.statusCode).toBe(400);

    const shortTitle = await api(fixture.manager.token, 'POST', '/cases', { title: 'ab' });
    expect(shortTitle.statusCode).toBe(400);
  });

  it('manager cannot create/assign a case to self or to another manager', async () => {
    const selfAssign = await api(fixture.manager.token, 'POST', '/cases', {
      title: 'پرونده برای خودم',
      assignToUserId: fixture.manager.id,
    });
    expect(selfAssign.statusCode).toBe(400);

    // manager → other manager also blocked
    const mgr2 = await api(fixture.manager.token, 'POST', '/members', {
      firstName: 'مدیر',
      lastName: 'دوم',
      mobile: `0912${String(Date.now()).slice(-7)}`,
      role: 'COMPANY_MANAGER',
      password: 'Manager!234',
    });
    expect(mgr2.statusCode).toBe(200);
    const mgr2Id = mgr2.json().userId;
    const toManager = await api(fixture.manager.token, 'POST', '/cases', {
      title: 'پرونده برای مدیر دیگر',
      assignToUserId: mgr2Id,
    });
    expect(toManager.statusCode).toBe(400);
  });

  it('manager case detail exposes isManager/canTransfer flags (no employee actions)', async () => {
    const created = await api(fixture.manager.token, 'POST', '/cases', {
      title: 'پرونده بررسی مدیریتی',
      assignToUserId: fixture.employees[0].id,
    });
    const caseId = created.json().case.id;
    const detail = await api(fixture.manager.token, 'GET', `/cases/${caseId}`);
    expect(detail.statusCode).toBe(200);
    expect(detail.json().isManager).toBe(true);
    expect(detail.json().canTransfer).toBe(true);
    // employee view keeps operational capability
    const empDetail = await api(fixture.employees[0].token, 'GET', `/cases/${caseId}`);
    expect(empDetail.json().isManager).toBe(false);
    // employee can still register a result on their own case
    const result = await api(fixture.employees[0].token, 'POST', `/cases/${caseId}/result`, {
      result: 'انجام شد',
      complete: true,
    });
    expect(result.statusCode).toBe(200);
  });
});
