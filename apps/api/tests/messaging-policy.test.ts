import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { config } from '../src/config.js';
import { prisma } from '../src/lib/prisma.js';
import { resolveNotificationPolicy } from '../src/modules/messaging/messaging-policy.js';
import { encryptProviderCredentials } from '../src/modules/messaging/provider-configuration.js';
import { cleanup, closeTestApp, getTestApp, seedFixture } from './helpers.js';

const testKey = 'test-only-master-key-with-at-least-32-characters';

describe('messaging policy precedence', () => {
  it.each([
    [false, true, null, null, false],
    [true, false, null, null, false],
    [true, true, null, null, true],
    [true, true, false, true, false],
    [true, true, true, false, false],
    [true, true, true, true, true],
  ] as const)('resolves system/company/membership precedence', (systemEnabled, notificationEnabled, company, member, expected) => {
    expect(resolveNotificationPolicy({
      systemEnabled,
      systemNotificationEnabled: notificationEnabled,
      companyPreference: company,
      membershipPreference: member,
    }).enabled).toBe(expected);
  });

  it('distinguishes inherited from explicit false', () => {
    expect(resolveNotificationPolicy({ systemEnabled: true, systemNotificationEnabled: true, companyPreference: null, membershipPreference: null }))
      .toMatchObject({ enabled: true, companySource: 'INHERITED', membershipSource: 'INHERITED' });
    expect(resolveNotificationPolicy({ systemEnabled: true, systemNotificationEnabled: true, companyPreference: false, membershipPreference: null }))
      .toMatchObject({ enabled: false, companySource: 'EXPLICIT' });
  });
});

describe('messaging settings routes', () => {
  let app: Awaited<ReturnType<typeof getTestApp>>;
  let fixture: Awaited<ReturnType<typeof seedFixture>>;
  let adminToken: string;
  const originalKey = config.messagingCredentialsKey;

  beforeAll(async () => {
    config.messagingCredentialsKey = testKey;
    app = await getTestApp();
    fixture = await seedFixture(2);
    adminToken = app.jwt.sign({ sub: 'policy-test-admin', kind: 'SYSTEM_ADMIN' });
  });

  beforeEach(async () => {
    await prisma.messagingSystemPolicy.deleteMany({ where: { channel: { in: ['TELEGRAM', 'BALE'] } } });
  });

  afterAll(async () => {
    await prisma.messagingSystemPolicy.deleteMany({ where: { channel: { in: ['TELEGRAM', 'BALE'] } } });
    await cleanup();
    await closeTestApp();
    config.messagingCredentialsKey = originalKey;
  });

  it('allows only system admin to save global policy', async () => {
    const payload = { channels: [
      { channel: 'TELEGRAM', enabled: true, notificationEnabled: true, otpEnabled: true, displayName: 'Telegram', botUsername: 'test_telegram', botToken: 'test-telegram-token' },
      { channel: 'BALE', enabled: true, notificationEnabled: true, otpEnabled: false, displayName: 'Bale', botUsername: 'test_bale', botToken: 'test-bale-token' },
    ] };
    const forbidden = await app.inject({ method: 'PATCH', url: '/api/v1/admin/messaging-settings', headers: { authorization: `Bearer ${fixture.employees[0]!.token}` }, payload });
    expect(forbidden.statusCode).toBe(403);
    const saved = await app.inject({ method: 'PATCH', url: '/api/v1/admin/messaging-settings', headers: { authorization: `Bearer ${adminToken}` }, payload });
    expect(saved.statusCode).toBe(200);
  });

  it('scopes company policy to the authenticated manager company', async () => {
    const payload = { channels: [
      { channel: 'TELEGRAM', notificationEnabled: null },
      { channel: 'BALE', notificationEnabled: false },
    ] };
    const employee = await app.inject({ method: 'PATCH', url: '/api/v1/messaging/settings/company', headers: { authorization: `Bearer ${fixture.employees[0]!.token}` }, payload });
    expect(employee.statusCode).toBe(403);
    const manager = await app.inject({ method: 'PATCH', url: '/api/v1/messaging/settings/company', headers: { authorization: `Bearer ${fixture.manager.token}` }, payload });
    expect(manager.statusCode).toBe(200);
    expect(await prisma.companyMessagingPolicy.findMany({ where: { companyId: fixture.company.id } })).toMatchObject([
      { channel: 'BALE', notificationEnabled: false },
    ]);
  });

  it('stores both explicit none and unset for the authenticated membership only', async () => {
    await prisma.messagingSystemPolicy.create({ data: {
      channel: 'TELEGRAM', enabled: true, notificationEnabled: true, otpEnabled: true,
      displayName: 'Telegram', botUsername: 'test_telegram',
      credentialsEncrypted: encryptProviderCredentials({ botToken: 'test-telegram-token' }, testKey),
    } });
    const token = fixture.employees[0]!.token;
    const none = await app.inject({ method: 'PATCH', url: '/api/v1/messaging/settings/me', headers: { authorization: `Bearer ${token}` }, payload: {
      channels: [
        { channel: 'TELEGRAM', notificationEnabled: false },
        { channel: 'BALE', notificationEnabled: false },
      ],
      otpChannel: 'TELEGRAM',
    } });
    expect(none.statusCode).toBe(200);
    expect(await prisma.membershipMessagingPreference.count({ where: { membershipId: fixture.employees[0]!.membershipId } })).toBe(2);
    expect(await prisma.membershipMessagingPreference.count({ where: { membershipId: fixture.employees[1]!.membershipId } })).toBe(0);

    const unset = await app.inject({ method: 'PATCH', url: '/api/v1/messaging/settings/me', headers: { authorization: `Bearer ${token}` }, payload: {
      channels: [
        { channel: 'TELEGRAM', notificationEnabled: null },
        { channel: 'BALE', notificationEnabled: null },
      ],
      otpChannel: null,
    } });
    expect(unset.statusCode).toBe(200);
    expect(await prisma.membershipMessagingPreference.count({ where: { membershipId: fixture.employees[0]!.membershipId } })).toBe(0);
  });

  it('rejects an OTP channel disabled by system policy', async () => {
    const response = await app.inject({ method: 'PATCH', url: '/api/v1/messaging/settings/me', headers: { authorization: `Bearer ${fixture.employees[0]!.token}` }, payload: {
      channels: [
        { channel: 'TELEGRAM', notificationEnabled: null },
        { channel: 'BALE', notificationEnabled: null },
      ],
      otpChannel: 'BALE',
    } });
    expect(response.statusCode).toBe(400);
  });

  it('marks the stored settings as not enforced', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/messaging/settings/me', headers: { authorization: `Bearer ${fixture.employees[0]!.token}` } });
    expect(response.statusCode).toBe(200);
    expect(response.json().enforcementStatus).toBe('NOT_ACTIVE_UNTIL_P8_P9');
  });
});
