import { describe, it, expect, beforeAll, afterAll, vi, afterEach, beforeEach } from 'vitest';
import { getTestApp, closeTestApp, seedFixture } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';
import { MessagingChannel } from '@prisma/client';
import { encryptProviderCredentials } from '../src/modules/messaging/provider-configuration.js';
import { config } from '../src/config.js';

const mocks = vi.hoisted(() => ({
  telegramSend: vi.fn(async () => undefined),
  baleSend: vi.fn(async () => undefined),
  capturedByDestination: new Map<string, string>(),
}));

vi.mock('../src/modules/messaging/db-backed-provider.js', () => ({
  getDatabaseConfiguredProvider: (channel: string) => ({
    name: channel.toLowerCase(),
    send: vi.fn(async ({ destination, text }: { destination: string; text: string }) => {
      const match = text.match(/(\d{6})/);
      if (match) mocks.capturedByDestination.set(destination, match[1]);
      if (channel === 'TELEGRAM') await mocks.telegramSend({ destination, text });
      else await mocks.baleSend({ destination, text });
    }),
  }),
}));

let fixture: Awaited<ReturnType<typeof seedFixture>>;

async function mobileOf(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { mobile: true },
  });
  return user.mobile;
}

let managerMobile = '';

let mobileCounter = 0;
const createdMobiles: string[] = [];
function uniqueMobile(): string {
  mobileCounter += 1;
  const seed = `${Date.now()}`.slice(-6);
  const suffix = String(mobileCounter * 7 + 11).padStart(3, '0').slice(-3);
  const mobile = `09${seed}${suffix}`;
  if (!/^09\d{9}$/.test(mobile)) throw new Error(`bad test mobile: ${mobile}`);
  createdMobiles.push(mobile);
  return mobile;
}

const testKey = 'test-only-master-key-with-at-least-32-characters';
const originalKey = config.messagingCredentialsKey;
const originalEnvKey = process.env.MESSAGING_CREDENTIALS_KEY;

async function prepareOtpChannel(mobile: string, channel: MessagingChannel = MessagingChannel.TELEGRAM) {
  const user = await prisma.user.findUniqueOrThrow({ where: { mobile }, select: { id: true } });
  const credentialsEncrypted = encryptProviderCredentials({ botToken: `test-token-${channel}` }, testKey);
  await prisma.messagingSystemPolicy.upsert({
    where: { channel },
    update: { enabled: true, otpEnabled: true, credentialsEncrypted, displayName: channel, botUsername: `test_${channel.toLowerCase()}` },
    create: { channel, enabled: true, otpEnabled: true, credentialsEncrypted, displayName: channel, botUsername: `test_${channel.toLowerCase()}` },
  });
  const externalUserId = `otp-${channel.toLowerCase()}-${user.id}`;
  await prisma.messagingIdentity.upsert({
    where: { userId_channel: { userId: user.id, channel } },
    update: { externalUserId, destinationId: externalUserId, status: 'ACTIVE', verifiedAt: new Date(), verificationMethod: 'TEST_OTP' },
    create: { userId: user.id, channel, externalUserId, destinationId: externalUserId, status: 'ACTIVE', verifiedAt: new Date(), verificationMethod: 'TEST_OTP' },
  });
  await prisma.userMessagingPreference.upsert({
    where: { userId: user.id },
    update: { otpChannel: channel },
    create: { userId: user.id, otpChannel: channel },
  });
  mocks.capturedByDestination.clear();
  mocks.telegramSend.mockClear();
  mocks.baleSend.mockClear();
  return { externalUserId };
}

async function capturedOtpForMobile(mobile: string): Promise<string | undefined> {
  const user = await prisma.user.findUnique({ where: { mobile }, select: { id: true } });
  if (!user) return undefined;
  const pref = await prisma.userMessagingPreference.findUnique({ where: { userId: user.id }, select: { otpChannel: true } });
  const channel = pref?.otpChannel ?? MessagingChannel.TELEGRAM;
  const identity = await prisma.messagingIdentity.findUnique({ where: { userId_channel: { userId: user.id, channel } }, select: { externalUserId: true, destinationId: true } });
  const dest = identity?.destinationId ?? identity?.externalUserId;
  if (!dest) return undefined;
  return mocks.capturedByDestination.get(dest);
}

beforeAll(async () => {
  config.messagingCredentialsKey = testKey;
  process.env.MESSAGING_CREDENTIALS_KEY = testKey;
  await getTestApp();
  fixture = await seedFixture(1);
  managerMobile = await mobileOf(fixture.manager.id);
  // Ensure clean state for OTP channel tests
  await prisma.messagingSystemPolicy.deleteMany({ where: { channel: { in: [MessagingChannel.TELEGRAM, MessagingChannel.BALE] } } });
});

afterAll(async () => {
  if (createdMobiles.length > 0) {
    const users = await prisma.user.findMany({ where: { mobile: { in: createdMobiles } }, select: { id: true } });
    const ids = users.map((u) => u.id);
    if (ids.length) {
      await prisma.messagingIdentity.deleteMany({ where: { userId: { in: ids } } });
      await prisma.userMessagingPreference.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { mobile: { in: createdMobiles } } });
    }
  }
  await prisma.messagingSystemPolicy.deleteMany({ where: { channel: { in: [MessagingChannel.TELEGRAM, MessagingChannel.BALE] } } });
  config.messagingCredentialsKey = originalKey;
  process.env.MESSAGING_CREDENTIALS_KEY = originalEnvKey;
  await fixture?.cleanup();
  await closeTestApp();
});

afterEach(() => {
  vi.restoreAllMocks();
  mocks.capturedByDestination.clear();
});

async function post(url: string, payload?: unknown, token?: string) {
  const app = await getTestApp();
  return app.inject({
    method: 'POST',
    url: `/api/v1${url}`,
    ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}),
    payload,
  });
}

async function createPasswordlessEmployee(mobile: string) {
  const res = await post(
    '/members',
    { firstName: 'otp', lastName: 'تستی', mobile, role: 'EMPLOYEE' },
    fixture.manager.token,
  );
  expect(res.statusCode).toBe(200);
  expect(res.json().requiresOtpSignup).toBe(true);
  return res.json().userId as string;
}

async function createPasswordedEmployee(mobile: string) {
  const res = await post(
    '/members',
    {
      firstName: 'pwd',
      lastName: 'تستی',
      mobile,
      role: 'EMPLOYEE',
      password: 'Seed!23456',
    },
    fixture.manager.token,
  );
  expect(res.statusCode).toBe(200);
  expect(res.json().requiresOtpSignup).toBe(false);
}

describe('OTP purpose isolation & security (ACTIVATION vs PASSWORD_RESET)', () => {
  it('activation flow still works end-to-end (request → verify → password → login)', async () => {
    const mobile = uniqueMobile();
    await createPasswordlessEmployee(mobile);
    await prepareOtpChannel(mobile, MessagingChannel.TELEGRAM);

    const req = await post('/auth/otp/request', { mobile });
    expect(req.statusCode).toBe(200);
    const code = await capturedOtpForMobile(mobile);
    expect(code).toMatch(/^\d{6}$/);

    const verify = await post('/auth/otp/verify', { mobile, code });
    expect(verify.statusCode).toBe(200);
    const { resetToken, purpose } = verify.json();
    expect(purpose).toBe('ACTIVATION');
    expect(resetToken).toBeTruthy();

    const setPassword = await post('/auth/password', {
      mobile,
      resetToken,
      password: 'NewPass!234',
    });
    expect(setPassword.statusCode).toBe(200);

    const login = await post('/auth/login', { mobile, password: 'NewPass!234' });
    expect(login.statusCode).toBe(200);
  });

  it('wrong OTP increments attempts and 5 failures invalidate the code', async () => {
    const mobile = uniqueMobile();
    await createPasswordlessEmployee(mobile);
    await prepareOtpChannel(mobile);

    await post('/auth/otp/request', { mobile });
    const code = (await capturedOtpForMobile(mobile))!;
    const wrongCode = '000000' === code ? '111111' : '000000';

    for (let i = 0; i < 5; i++) {
      const wrong = await post('/auth/otp/verify', { mobile, code: wrongCode });
      expect(wrong.statusCode).toBe(400);
      expect(wrong.json().message).toContain('کد تأیید نادرست');
    }
    const sixth = await post('/auth/otp/verify', { mobile, code });
    expect(sixth.statusCode).toBe(400);
    expect(sixth.json().message).toContain('بیش از حد');
    const after = await post('/auth/otp/verify', { mobile, code });
    expect(after.statusCode).toBe(400);
    expect(after.json().message).toContain('منقضی');
  });

  it('activation OTP cannot be used for password reset (purpose isolation)', async () => {
    const mobile = uniqueMobile();
    await createPasswordlessEmployee(mobile);
    await prepareOtpChannel(mobile);

    await post('/auth/otp/request', { mobile });
    const activationCode = (await capturedOtpForMobile(mobile))!;

    const resetVerify = await post('/auth/forgot-password/verify', { mobile, code: activationCode });
    expect(resetVerify.statusCode).toBe(400);

    const activationVerify = await post('/auth/otp/verify', { mobile, code: activationCode });
    expect(activationVerify.statusCode).toBe(200);
    const { resetToken, purpose } = activationVerify.json();
    expect(purpose).toBe('ACTIVATION');
    expect(resetToken).toBeTruthy();
  });

  it('password-reset OTP cannot be used for activation', async () => {
    const mobile = uniqueMobile();
    await createPasswordedEmployee(mobile);
    await prepareOtpChannel(mobile, MessagingChannel.BALE);

    const req = await post('/auth/forgot-password/request', { mobile });
    expect(req.statusCode).toBe(200);
    const resetCode = await capturedOtpForMobile(mobile);
    expect(resetCode).toMatch(/^\d{6}$/);

    const activationVerify = await post('/auth/otp/verify', { mobile, code: resetCode });
    expect(activationVerify.statusCode).toBe(400);

    const resetVerify = await post('/auth/forgot-password/verify', { mobile, code: resetCode });
    expect(resetVerify.statusCode).toBe(200);
    expect(resetVerify.json().purpose).toBe('PASSWORD_RESET');
  });

  it('OTP is one-time: cannot be reused after successful verification', async () => {
    const mobile = uniqueMobile();
    await createPasswordlessEmployee(mobile);
    await prepareOtpChannel(mobile);

    await post('/auth/otp/request', { mobile });
    const code = (await capturedOtpForMobile(mobile))!;

    const first = await post('/auth/otp/verify', { mobile, code });
    expect(first.statusCode).toBe(200);

    const replay = await post('/auth/otp/verify', { mobile, code });
    expect(replay.statusCode).toBe(400);
  });

  it('one outstanding activation OTP per mobile: second request is 409', async () => {
    const mobile = uniqueMobile();
    await createPasswordlessEmployee(mobile);
    await prepareOtpChannel(mobile);

    const first = await post('/auth/otp/request', { mobile });
    expect(first.statusCode).toBe(200);

    const second = await post('/auth/otp/request', { mobile });
    expect(second.statusCode).toBe(409);
  });

  it('activation token cannot be used for password reset (token purpose binding)', async () => {
    const mobile = uniqueMobile();
    await createPasswordlessEmployee(mobile);
    await prepareOtpChannel(mobile);

    await post('/auth/otp/request', { mobile });
    const code = (await capturedOtpForMobile(mobile))!;

    const verify = await post('/auth/otp/verify', { mobile, code });
    const { resetToken } = verify.json();

    const resetAttempt = await post('/auth/forgot-password/reset', {
      mobile,
      resetToken,
      password: 'Hacked!234',
    });
    expect(resetAttempt.statusCode).toBe(401);

    const setPassword = await post('/auth/password', {
      mobile,
      resetToken,
      password: 'Proper!234',
    });
    expect(setPassword.statusCode).toBe(200);
  });

  it('reset token cannot be used for activation (endpoint refuses passwordless-only op)', async () => {
    const mobile = uniqueMobile();
    await createPasswordedEmployee(mobile);
    await prepareOtpChannel(mobile);

    await post('/auth/forgot-password/request', { mobile });
    const code = (await capturedOtpForMobile(mobile))!;

    const verify = await post('/auth/forgot-password/verify', { mobile, code });
    expect(verify.statusCode).toBe(200);
    const { resetToken } = verify.json();

    const activationAttempt = await post('/auth/password', {
      mobile,
      resetToken,
      password: 'Whatever!234',
    });
    expect(activationAttempt.statusCode).toBe(409);
  });
});

describe('Forgot password', () => {
  it('request endpoint does not reveal account existence (unknown vs known identical)', async () => {
    const knownMobile = uniqueMobile();
    await createPasswordedEmployee(knownMobile);
    await prepareOtpChannel(knownMobile);

    const unknown = await post('/auth/forgot-password/request', { mobile: '09999999999' });
    const known = await post('/auth/forgot-password/request', { mobile: knownMobile });
    expect(unknown.statusCode).toBe(200);
    expect(known.statusCode).toBe(200);
    expect(unknown.json()).toEqual(known.json());
  });

  it('passwordless account cannot use password reset', async () => {
    const mobile = uniqueMobile();
    await createPasswordlessEmployee(mobile);
    await prepareOtpChannel(mobile);

    const req = await post('/auth/forgot-password/request', { mobile });
    expect(req.statusCode).toBe(200);

    const verify = await post('/auth/forgot-password/verify', { mobile, code: '123456' });
    expect(verify.statusCode).toBe(400);
  });

  it('full reset flow: verify issues one-time token, reset changes password, old password stops working', async () => {
    const mobile = uniqueMobile();
    await createPasswordedEmployee(mobile);
    await prepareOtpChannel(mobile, MessagingChannel.BALE);
    const oldPassword = 'Seed!23456';

    await post('/auth/forgot-password/request', { mobile });
    const code = (await capturedOtpForMobile(mobile))!;

    const verify = await post('/auth/forgot-password/verify', { mobile, code });
    expect(verify.statusCode).toBe(200);
    const { resetToken, purpose } = verify.json();
    expect(purpose).toBe('PASSWORD_RESET');

    const reset = await post('/auth/forgot-password/reset', {
      mobile,
      resetToken,
      password: 'Reset!23445',
    });
    expect(reset.statusCode).toBe(200);

    const oldLogin = await post('/auth/login', { mobile, password: oldPassword });
    expect(oldLogin.statusCode).toBe(401);
    const newLogin = await post('/auth/login', { mobile, password: 'Reset!23445' });
    expect(newLogin.statusCode).toBe(200);

    const replay = await post('/auth/forgot-password/reset', {
      mobile,
      resetToken,
      password: 'Again!23445',
    });
    expect(replay.statusCode).toBe(401);
  });

  it('reset token is required and invalid tokens are rejected', async () => {
    const noToken = await post('/auth/forgot-password/reset', {
      mobile: managerMobile,
      password: 'Some!23456',
    });
    expect(noToken.statusCode).toBe(400);

    const badToken = await post('/auth/forgot-password/reset', {
      mobile: managerMobile,
      resetToken: 'definitely-not-a-real-token-value',
      password: 'Some!23456',
    });
    expect(badToken.statusCode).toBe(401);
  });

  it('a reset token bound to another user cannot reset someone else’s password', async () => {
    const requestorMobile = uniqueMobile();
    const victimMobile = uniqueMobile();
    await createPasswordedEmployee(requestorMobile);
    await createPasswordedEmployee(victimMobile);
    await prepareOtpChannel(requestorMobile, MessagingChannel.BALE);
    await prepareOtpChannel(victimMobile, MessagingChannel.BALE);

    await post('/auth/forgot-password/request', { mobile: requestorMobile });
    const code = (await capturedOtpForMobile(requestorMobile))!;
    const verify = await post('/auth/forgot-password/verify', {
      mobile: requestorMobile,
      code,
    });
    expect(verify.statusCode).toBe(200);
    const { resetToken } = verify.json();

    const crossUser = await post('/auth/forgot-password/reset', {
      mobile: victimMobile,
      resetToken,
      password: 'Stolen!2345',
    });
    expect(crossUser.statusCode).toBe(401);

    const victimLogin = await post('/auth/login', { mobile: victimMobile, password: 'Seed!23456' });
    expect(victimLogin.statusCode).toBe(200);
  });
});

describe('Change password (logged-in)', () => {
  it('unauthenticated request is rejected', async () => {
    const res = await post('/auth/change-password', {
      currentPassword: 'x',
      newPassword: 'NewOne!234',
    });
    expect(res.statusCode).toBe(401);
  });

  it('wrong current password is rejected', async () => {
    const res = await post(
      '/auth/change-password',
      { currentPassword: 'WrongPass!1', newPassword: 'NewOne!234' },
      fixture.manager.token,
    );
    expect(res.statusCode).toBe(401);
  });

  it('valid change: new password is hashed, old stops working, new works', async () => {
    const res = await post(
      '/auth/change-password',
      { currentPassword: 'Passw0rd!', newPassword: 'Manager!New1' },
      fixture.manager.token,
    );
    expect(res.statusCode).toBe(200);

    const user = await prisma.user.findUnique({ where: { mobile: managerMobile } });
    expect(user?.passwordHash).toBeTruthy();
    expect(user?.passwordHash).not.toBe('Manager!New1');
    expect(user?.passwordHash?.startsWith('$2')).toBe(true);

    const oldLogin = await post('/auth/login', { mobile: managerMobile, password: 'Passw0rd!' });
    expect(oldLogin.statusCode).toBe(401);
    const newLogin = await post('/auth/login', { mobile: managerMobile, password: 'Manager!New1' });
    expect(newLogin.statusCode).toBe(200);

    await post(
      '/auth/change-password',
      { currentPassword: 'Manager!New1', newPassword: 'Passw0rd!' },
      fixture.manager.token,
    );
  });

  it('password rules apply (too-short new password rejected)', async () => {
    const res = await post(
      '/auth/change-password',
      { currentPassword: 'Passw0rd!', newPassword: 'short' },
      fixture.manager.token,
    );
    expect(res.statusCode).toBe(400);
  });

  it('response never contains the password hash', async () => {
    const res = await post(
      '/auth/change-password',
      { currentPassword: 'Passw0rd!', newPassword: 'Manager!New2' },
      fixture.manager.token,
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.stringify(res.json())).not.toContain('$2');
    await post(
      '/auth/change-password',
      { currentPassword: 'Manager!New2', newPassword: 'Passw0rd!' },
      fixture.manager.token,
    );
  });
});
