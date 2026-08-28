import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestApp, closeTestApp, seedFixture } from './helpers.js';
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

describe('Customer domain foundation', () => {
  it('lets a manager create/search customer master data and writes field-only audit evidence', async () => {
    const created = await api(fixture.manager.token, 'POST', '/customers', {
      type: 'LEGAL',
      name: 'شرکت مشتری تستی',
      phone: '02188776655',
      nationalId: '14001234567',
      economicCode: '411111111111',
      email: 'finance@example.test',
      address: 'تهران، نشانی مشتری',
      notes: 'مشتری سازمانی',
    });
    expect(created.statusCode).toBe(200);
    const customer = created.json().customer;
    expect(customer.companyId).toBe(fixture.company.id);

    const list = await api(
      fixture.manager.token,
      'GET',
      `/customers?search=${encodeURIComponent('مشتری تستی')}`,
    );
    expect(list.statusCode).toBe(200);
    expect(list.json().items.some((item: { id: string }) => item.id === customer.id)).toBe(true);

    const managerSensitiveSearch = await api(
      fixture.manager.token,
      'GET',
      `/customers?search=${encodeURIComponent('14001234567')}`,
    );
    expect(managerSensitiveSearch.statusCode).toBe(200);
    expect(managerSensitiveSearch.json().items.some((item: { id: string }) => item.id === customer.id)).toBe(true);

    const employeeSensitiveSearch = await api(
      fixture.employees[0].token,
      'GET',
      `/customers?search=${encodeURIComponent('14001234567')}`,
    );
    expect(employeeSensitiveSearch.statusCode).toBe(200);
    expect(employeeSensitiveSearch.json().items).toHaveLength(0);

    const audit = await prisma.sensitiveAuditLog.findFirst({
      where: { companyId: fixture.company.id, entityType: 'CUSTOMER', entityId: customer.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit?.action).toBe('MANAGER_CUSTOMER_CREATED');
    expect(audit?.changes).toMatchObject({
      fields: expect.arrayContaining(['economicCode', 'name', 'nationalId', 'type']),
    });
    expect(JSON.stringify(audit?.changes)).not.toContain('14001234567');
    expect(JSON.stringify(audit?.changes)).not.toContain('411111111111');
  });

  it('allows controlled employee quick-create but keeps full customer edits Manager-only', async () => {
    const employee = fixture.employees[0];
    const quick = await api(employee.token, 'POST', '/customers', {
      type: 'INDIVIDUAL',
      name: 'مشتری سریع کارمند',
      mobile: '09121112233',
    });
    expect(quick.statusCode).toBe(200);
    const customerId = quick.json().customer.id as string;

    const forbiddenCreate = await api(employee.token, 'POST', '/customers', {
      type: 'INDIVIDUAL',
      name: 'ثبت حساس توسط کارمند',
      address: 'نباید توسط کارمند ثبت شود',
    });
    expect(forbiddenCreate.statusCode).toBe(403);

    const employeeEdit = await api(employee.token, 'PATCH', `/customers/${customerId}`, {
      address: 'تلاش برای ویرایش',
    });
    expect(employeeEdit.statusCode).toBe(403);

    const managerEdit = await api(fixture.manager.token, 'PATCH', `/customers/${customerId}`, {
      address: 'نشانی تکمیل‌شده توسط مدیر',
      email: 'customer@example.test',
    });
    expect(managerEdit.statusCode).toBe(200);

    const auditRows = await prisma.sensitiveAuditLog.findMany({
      where: { companyId: fixture.company.id, entityType: 'CUSTOMER', entityId: customerId },
      orderBy: { createdAt: 'asc' },
    });
    expect(auditRows.some((row) => row.action === 'EMPLOYEE_CUSTOMER_QUICK_CREATED')).toBe(true);
    const updateAudit = auditRows.find((row) => row.action === 'MANAGER_CUSTOMER_UPDATED');
    expect(updateAudit?.changes).toMatchObject({ fields: ['address', 'email'] });
    expect(JSON.stringify(updateAudit?.changes)).not.toContain('نشانی تکمیل‌شده');
  });

  it('preserves company isolation across customer APIs and Case -> Customer attachment', async () => {
    const created = await api(fixture.manager.token, 'POST', '/customers', {
      type: 'LEGAL',
      name: 'مشتری شرکت اول',
      phone: '02110000001',
    });
    const customerId = created.json().customer.id as string;

    const foreignSearch = await api(
      otherFixture.manager.token,
      'GET',
      `/customers?search=${encodeURIComponent('مشتری شرکت اول')}`,
    );
    expect(foreignSearch.statusCode).toBe(200);
    expect(foreignSearch.json().items).toHaveLength(0);

    const foreignHistory = await api(
      otherFixture.manager.token,
      'GET',
      `/customers/${customerId}/history`,
    );
    expect(foreignHistory.statusCode).toBe(404);

    const foreignEdit = await api(otherFixture.manager.token, 'PATCH', `/customers/${customerId}`, {
      name: 'نباید تغییر کند',
    });
    expect(foreignEdit.statusCode).toBe(404);

    const foreignCase = await api(otherFixture.manager.token, 'POST', '/cases', {
      title: 'پرونده با مشتری شرکت دیگر',
      customerId,
    });
    expect(foreignCase.statusCode).toBe(400);
  });

  it('keeps customer relation optional and exposes customer case history for reporting foundation', async () => {
    const employee = fixture.employees[0];
    const quick = await api(employee.token, 'POST', '/customers', {
      type: 'INDIVIDUAL',
      name: 'مشتری دارای پرونده',
      mobile: '09124445566',
    });
    const customerId = quick.json().customer.id as string;

    const linked = await api(employee.token, 'POST', '/cases', {
      title: 'پیگیری مشتری متصل',
      customerId,
    });
    expect(linked.statusCode).toBe(200);
    const linkedCaseId = linked.json().case.id as string;

    const linkedDetail = await api(employee.token, 'GET', `/cases/${linkedCaseId}`);
    expect(linkedDetail.statusCode).toBe(200);
    expect(linkedDetail.json().customer).toMatchObject({ id: customerId, name: 'مشتری دارای پرونده' });

    const internal = await api(employee.token, 'POST', '/cases', {
      title: 'پرونده داخلی بدون مشتری',
    });
    expect(internal.statusCode).toBe(200);
    const internalDetail = await api(employee.token, 'GET', `/cases/${internal.json().case.id}`);
    expect(internalDetail.json().customer).toBeNull();

    const history = await api(fixture.manager.token, 'GET', `/customers/${customerId}/history`);
    expect(history.statusCode).toBe(200);
    expect(history.json().summary.totalCases).toBe(1);
    expect(history.json().items[0]).toMatchObject({ id: linkedCaseId, title: 'پیگیری مشتری متصل' });
  });

  it('archives instead of deleting customers and blocks new case links until restore', async () => {
    const created = await api(fixture.manager.token, 'POST', '/customers', {
      type: 'INDIVIDUAL',
      name: 'مشتری قابل بایگانی',
      mobile: '09127778899',
    });
    const customerId = created.json().customer.id as string;

    const archived = await api(fixture.manager.token, 'POST', `/customers/${customerId}/archive`);
    expect(archived.statusCode).toBe(200);
    expect(archived.json().customer.isActive).toBe(false);

    const employeeList = await api(fixture.employees[0].token, 'GET', '/customers?search=قابل');
    expect(employeeList.statusCode).toBe(200);
    expect(employeeList.json().items).toHaveLength(0);

    const blockedCase = await api(fixture.manager.token, 'POST', '/cases', {
      title: 'پرونده با مشتری بایگانی',
      customerId,
    });
    expect(blockedCase.statusCode).toBe(400);

    const restored = await api(fixture.manager.token, 'POST', `/customers/${customerId}/restore`);
    expect(restored.statusCode).toBe(200);
    expect(restored.json().customer.isActive).toBe(true);

    const linkedCase = await api(fixture.manager.token, 'POST', '/cases', {
      title: 'پرونده بعد از بازیابی مشتری',
      customerId,
    });
    expect(linkedCase.statusCode).toBe(200);
  });
});
