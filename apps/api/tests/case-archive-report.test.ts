import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestApp, closeTestApp, seedFixture } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';

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

const ACTIVE = new Set(['OPEN', 'WAITING_ACCEPTANCE', 'IN_PROGRESS', 'WAITING_APPROVAL']);
const ARCHIVED = new Set(['DONE', 'CANCELLED']);

describe('Case archive filters', () => {
  it('splits active vs archived cases via archive query param', async () => {
    const managerToken = fixture.manager.token;
    const employee = fixture.employees[0];

    const open = await api(managerToken, 'POST', '/cases', {
      title: 'پرونده فعال برای بایگانی',
    });
    expect(open.statusCode).toBe(200);
    const openId = open.json().case.id as string;

    const done = await api(managerToken, 'POST', '/cases', {
      title: 'پرونده تکمیلی برای بایگانی',
      assignToUserId: employee.id,
    });
    expect(done.statusCode).toBe(200);
    const doneId = done.json().case.id as string;

    const cancelled = await api(managerToken, 'POST', '/cases', {
      title: 'پرونده لغوشده برای بایگانی',
    });
    expect(cancelled.statusCode).toBe(200);
    const cancelledId = cancelled.json().case.id as string;

    const complete = await api(employee.token, 'POST', `/cases/${doneId}/result`, {
      result: 'انجام شد',
      complete: true,
    });
    expect(complete.statusCode).toBe(200);

    const cancel = await api(managerToken, 'POST', `/cases/${cancelledId}/cancel`);
    expect(cancel.statusCode).toBe(200);

    const activeList = await api(managerToken, 'GET', '/cases?archive=active&pageSize=100');
    expect(activeList.statusCode).toBe(200);
    const activeItems = activeList.json().items as { id: string; status: string }[];
    expect(activeItems.length).toBeGreaterThan(0);
    for (const item of activeItems) expect(ACTIVE.has(item.status)).toBe(true);
    expect(activeItems.some((item) => item.id === openId)).toBe(true);
    expect(activeItems.some((item) => item.id === doneId)).toBe(false);
    expect(activeItems.some((item) => item.id === cancelledId)).toBe(false);

    const archivedList = await api(managerToken, 'GET', '/cases?archive=archived&pageSize=100');
    expect(archivedList.statusCode).toBe(200);
    const archivedItems = archivedList.json().items as { id: string; status: string }[];
    expect(archivedItems.length).toBeGreaterThan(0);
    for (const item of archivedItems) expect(ARCHIVED.has(item.status)).toBe(true);
    expect(archivedItems.some((item) => item.id === openId)).toBe(false);
    expect(archivedItems.some((item) => item.id === doneId)).toBe(true);
    expect(archivedItems.some((item) => item.id === cancelledId)).toBe(true);

    const allList = await api(managerToken, 'GET', '/cases?pageSize=100');
    expect(allList.statusCode).toBe(200);
    const allItems = allList.json().items as { id: string }[];
    expect(allItems.some((item) => item.id === openId)).toBe(true);
    expect(allItems.some((item) => item.id === doneId)).toBe(true);
    expect(allItems.some((item) => item.id === cancelledId)).toBe(true);

    // employee visibility still applies with archive filters
    const employeeActive = await api(employee.token, 'GET', '/cases?archive=active&pageSize=100');
    expect(employeeActive.statusCode).toBe(200);
    const employeeItems = employeeActive.json().items as { id: string; status: string }[];
    for (const item of employeeItems) expect(ACTIVE.has(item.status)).toBe(true);
    expect(employeeItems.some((item) => item.id === openId)).toBe(false);
  });

  it('accept endpoint works without a request body (mobile content-type regression)', async () => {
    const employee = fixture.employees[0];
    const assigned = await api(fixture.manager.token, 'POST', '/cases', {
      title: 'پرونده ارجاعی برای پذیرش بدون بدنه',
      assignToUserId: employee.id,
    });
    expect(assigned.statusCode).toBe(200);
    const caseId = assigned.json().case.id as string;

    const accept = await api(employee.token, 'POST', `/cases/${caseId}/accept`);
    expect(accept.statusCode).toBe(200);
    expect(accept.json().case.status).toBe('IN_PROGRESS');
    expect(accept.json().case.currentOwnerId).toBe(employee.id);
  });
});

describe('Customer report filters', () => {
  it('filters by customerId, ownerId, caseTypeId and createdAt range', async () => {
    const managerToken = fixture.manager.token;
    const employee = fixture.employees[0];

    const customerRes = await api(managerToken, 'POST', '/customers', {
      type: 'INDIVIDUAL',
      name: 'مشتری گزارش بایگانی',
      mobile: `0912${String(Date.now()).slice(-7)}`,
    });
    expect(customerRes.statusCode).toBe(200);
    const customerId = customerRes.json().customer.id as string;

    const company = await api(managerToken, 'GET', '/companies/current');
    expect(company.statusCode).toBe(200);
    const caseTypeRes = await api(managerToken, 'POST', '/case-types', {
      name: `نوع گزارش ${Date.now()}`,
    });
    expect(caseTypeRes.statusCode).toBe(200);
    const caseTypeId = caseTypeRes.json().caseType.id as string;
    expect(Array.isArray(company.json().caseTypes)).toBe(true);

    const linked = await api(managerToken, 'POST', '/cases', {
      title: 'پرونده گزارش مشتری',
      customerId,
      caseTypeId,
      assignToUserId: employee.id,
    });
    expect(linked.statusCode).toBe(200);
    const caseId = linked.json().case.id as string;

    const unlinked = await api(managerToken, 'POST', '/cases', {
      title: 'پرونده بدون مشتری گزارش',
    });
    expect(unlinked.statusCode).toBe(200);

    const byCustomer = await api(
      managerToken,
      'GET',
      `/cases?customerId=${customerId}&pageSize=50`,
    );
    expect(byCustomer.statusCode).toBe(200);
    const customerItems = byCustomer.json().items as { id: string; customerId: string | null }[];
    expect(customerItems.length).toBeGreaterThan(0);
    expect(customerItems.every((item) => item.customerId === customerId)).toBe(true);
    expect(customerItems.some((item) => item.id === caseId)).toBe(true);

    const byOwner = await api(
      managerToken,
      'GET',
      `/cases?ownerId=${employee.id}&customerId=${customerId}&pageSize=50`,
    );
    expect(byOwner.statusCode).toBe(200);
    const ownerItems = byOwner.json().items as { currentOwnerId: string | null }[];
    expect(ownerItems.every((item) => item.currentOwnerId === employee.id)).toBe(true);
    expect(ownerItems.length).toBeGreaterThan(0);

    const byType = await api(
      managerToken,
      'GET',
      `/cases?caseTypeId=${caseTypeId}&pageSize=50`,
    );
    expect(byType.statusCode).toBe(200);
    const typeItems = byType.json().items as { caseTypeId: string | null }[];
    expect(typeItems.every((item) => item.caseTypeId === caseTypeId)).toBe(true);

    const today = new Date();
    const day = (offset: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const inRange = await api(
      managerToken,
      'GET',
      `/cases?customerId=${customerId}&from=${day(-1)}&to=${day(1)}&pageSize=50`,
    );
    expect(inRange.statusCode).toBe(200);
    expect(inRange.json().items.some((item: { id: string }) => item.id === caseId)).toBe(true);

    const outOfRange = await api(
      managerToken,
      'GET',
      `/cases?customerId=${customerId}&from=${day(30)}&to=${day(40)}&pageSize=50`,
    );
    expect(outOfRange.statusCode).toBe(200);
    expect(outOfRange.json().items).toHaveLength(0);
    expect(outOfRange.json().total).toBe(0);

    // combined archive + customer report filter
    const activeForCustomer = await api(
      managerToken,
      'GET',
      `/cases?customerId=${customerId}&archive=active&pageSize=50`,
    );
    expect(activeForCustomer.statusCode).toBe(200);
    for (const item of activeForCustomer.json().items as { status: string }[]) {
      expect(ACTIVE.has(item.status)).toBe(true);
    }
  });
});
