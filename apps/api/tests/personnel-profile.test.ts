import { existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestApp, closeTestApp, seedFixture } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';
import { config } from '../src/config.js';

let fixture: Awaited<ReturnType<typeof seedFixture>>;
let otherFixture: Awaited<ReturnType<typeof seedFixture>>;

beforeAll(async () => {
  await getTestApp();
  fixture = await seedFixture(1);
  otherFixture = await seedFixture(1);
});

afterAll(async () => {
  const employee = await prisma.user.findUnique({ where: { id: fixture.employees[0].id } });
  if (employee?.personnelPhotoPath) {
    const abs = path.resolve(config.storageDir, employee.personnelPhotoPath);
    if (existsSync(abs)) unlinkSync(abs);
  }
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

async function uploadPhoto(token: string, url: string, filename = 'personnel.png') {
  const app = await getTestApp();
  const boundary = `----followa-test-${Date.now()}`;
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    Buffer.from('tiny-test-image'),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return app.inject({
    method: 'POST',
    url: `/api/v1${url}`,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
      'content-length': String(body.length),
    },
    payload: body,
  });
}

describe('Personnel profile governance', () => {
  it('requires a complete employee profile before finalization', async () => {
    const employee = fixture.employees[0];
    const res = await api(employee.token, 'POST', '/profile/finalize');
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain('تکمیل');
  });

  it('allows employee photo/profile setup before finalization, then backend-locks self edits', async () => {
    const employee = fixture.employees[0];

    const photo = await uploadPhoto(employee.token, '/profile/photo');
    expect(photo.statusCode).toBe(200);

    const patched = await api(employee.token, 'PATCH', '/profile', {
      firstName: 'آرمان',
      lastName: 'رضایی',
      nationalId: '1234567890',
      birthDate: '1990-03-21T08:30:00.000Z',
      phone: '02112345678',
      address: 'تهران، خیابان تست',
      maritalStatus: 'SINGLE',
      bankCardNumber: '6037991234567890',
      bankIban: 'IR123456789012345678901234',
      bankName: 'بانک تست',
    });
    expect(patched.statusCode).toBe(200);

    const finalized = await api(employee.token, 'POST', '/profile/finalize');
    expect(finalized.statusCode).toBe(200);
    expect(finalized.json().user.profileFinalizedAt).toBeTruthy();

    const selfEdit = await api(employee.token, 'PATCH', '/profile', { address: 'تلاش برای تغییر' });
    expect(selfEdit.statusCode).toBe(403);

    const selfPhoto = await uploadPhoto(employee.token, '/profile/photo', 'second.png');
    expect(selfPhoto.statusCode).toBe(403);
  });

  it('lets only the same-company manager edit a finalized employee profile and replace photo', async () => {
    const employee = fixture.employees[0];

    const view = await api(
      fixture.manager.token,
      'GET',
      `/members/${employee.membershipId}/profile`,
    );
    expect(view.statusCode).toBe(200);
    expect(view.json().user.profileFinalizedAt).toBeTruthy();

    const managerEdit = await api(
      fixture.manager.token,
      'PATCH',
      `/members/${employee.membershipId}/profile`,
      { address: 'نشانی اصلاح‌شده توسط مدیر' },
    );
    expect(managerEdit.statusCode).toBe(200);
    expect(managerEdit.json().user.address).toBe('نشانی اصلاح‌شده توسط مدیر');

    const managerPhoto = await uploadPhoto(
      fixture.manager.token,
      `/members/${employee.membershipId}/photo`,
      'manager-replacement.png',
    );
    expect(managerPhoto.statusCode).toBe(200);

    const managerPhotoView = await api(
      fixture.manager.token,
      'GET',
      `/members/${employee.membershipId}/photo`,
    );
    expect(managerPhotoView.statusCode).toBe(200);
    expect(managerPhotoView.headers['content-type']).toContain('image/png');

    const auditRows = await prisma.sensitiveAuditLog.findMany({
      where: { companyId: fixture.company.id, entityType: 'USER_PROFILE', entityId: employee.id },
    });
    expect(auditRows.some((row) => row.action === 'EMPLOYEE_PROFILE_FINALIZED')).toBe(true);
    expect(auditRows.some((row) => row.action === 'MANAGER_PROFILE_UPDATE')).toBe(true);
    expect(auditRows.some((row) => row.action === 'MANAGER_PERSONNEL_PHOTO_UPDATE')).toBe(true);

    const managerAudit = auditRows.find((row) => row.action === 'MANAGER_PROFILE_UPDATE');
    expect(managerAudit?.changes).toMatchObject({ fields: ['address'] });
  });

  it('preserves company isolation for manager personnel endpoints', async () => {
    const employee = fixture.employees[0];

    const foreignView = await api(
      otherFixture.manager.token,
      'GET',
      `/members/${employee.membershipId}/profile`,
    );
    expect(foreignView.statusCode).toBe(404);

    const foreignEdit = await api(
      otherFixture.manager.token,
      'PATCH',
      `/members/${employee.membershipId}/profile`,
      { address: 'نباید ثبت شود' },
    );
    expect(foreignEdit.statusCode).toBe(404);

    const employeeManagerRoute = await api(
      employee.token,
      'GET',
      `/members/${employee.membershipId}/profile`,
    );
    expect(employeeManagerRoute.statusCode).toBe(403);
  });
});
