import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeTestApp, getTestApp, seedFixture } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';

let fixture: Awaited<ReturnType<typeof seedFixture>>;
let otherFixture: Awaited<ReturnType<typeof seedFixture>>;

beforeAll(async () => {
  await getTestApp();
  fixture = await seedFixture(2);
  otherFixture = await seedFixture(1);
});

afterAll(async () => {
  await fixture?.cleanup();
  await otherFixture?.cleanup();
  await closeTestApp();
});

async function request(token: string, method: 'GET' | 'POST', url: string, payload?: unknown) {
  const app = await getTestApp();
  return app.inject({
    method,
    url: `/api/v1${url}`,
    headers: { authorization: `Bearer ${token}` },
    payload,
  });
}

describe('case transfer candidates', () => {
  it('lets an employee read a minimal same-company employee directory', async () => {
    const actor = fixture.employees[0];
    const colleague = fixture.employees[1];
    const response = await request(actor.token, 'GET', '/members/transfer-candidates');

    expect(response.statusCode).toBe(200);
    const items = response.json().items as Array<Record<string, unknown>>;
    expect(items.some((item) => item.userId === colleague.id)).toBe(true);
    expect(items.some((item) => item.userId === actor.id)).toBe(false);
    expect(items.some((item) => item.userId === fixture.manager.id)).toBe(false);
    expect(items.some((item) => item.userId === otherFixture.employees[0].id)).toBe(false);
    expect(items.some((item) => item.userId === otherFixture.manager.id)).toBe(false);

    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual(['fullName', 'jobTitle', 'userId']);
      expect(item).not.toHaveProperty('mobile');
      expect(item).not.toHaveProperty('nationalId');
      expect(item).not.toHaveProperty('bankIban');
    }
  });

  it('lets a manager see active employee transfer targets without exposing managers', async () => {
    const response = await request(fixture.manager.token, 'GET', '/members/transfer-candidates');
    expect(response.statusCode).toBe(200);
    const items = response.json().items as Array<{ userId: string }>;
    expect(items.map((item) => item.userId).sort()).toEqual(
      fixture.employees.map((employee) => employee.id).sort(),
    );
  });

  it('rejects a suspended caller even with a previously valid token', async () => {
    const actor = fixture.employees[0];
    await prisma.companyMembership.update({
      where: { id: actor.membershipId },
      data: { isActive: false },
    });
    try {
      const response = await request(actor.token, 'GET', '/members/transfer-candidates');
      expect(response.statusCode).toBe(403);
    } finally {
      await prisma.companyMembership.update({
        where: { id: actor.membershipId },
        data: { isActive: true },
      });
    }
  });

  it('does not allow transferring a case to a manager account', async () => {
    const employee = fixture.employees[0];
    const created = await request(employee.token, 'POST', '/cases', {
      title: 'پرونده تست مقصد انتقال',
    });
    expect(created.statusCode).toBe(200);
    const caseId = created.json().case.id as string;

    const transfer = await request(employee.token, 'POST', `/cases/${caseId}/transfer`, {
      toUserId: fixture.manager.id,
      note: 'نباید به مدیر منتقل شود',
    });
    expect(transfer.statusCode).toBe(400);
  });
});
