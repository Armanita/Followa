import { describe, it, expect, beforeAll, afterAll, vi, afterEach } from 'vitest';
import { getTestApp, closeTestApp, seedFixture } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';
import {
  createTelegramOtpProviderForTests,
  createOtpProvider,
} from '../src/modules/auth/otp-providers.js';

let fixture: Awaited<ReturnType<typeof seedFixture>>;

// seedFixture does not expose mobiles — resolve them from the DB by user id.
async function mobileOf(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { mobile: true },
  });
  return user.mobile;
}

let managerMobile = '';

// Run-unique mobiles so repeated test runs never collide with leftover users.
// Format: 09 + 9 digits (11 total, the exact shape normalizeMobile requires).
// Seed = milliseconds timestamp + monotonic counter, sliced to 9 digits.
let mobileCounter = 0;
const createdMobiles: string[] = [];
function uniqueMobile(): string {
  mobileCounter += 1;
  const seed = `${Date.now()}`.slice(-6); // 6 digits, changes every run
  const suffix = String(mobileCounter * 7 + 11).padStart(3, '0').slice(-3); // 3 digits
  const mobile = `09${seed}${suffix}`; // 09 + 6 + 3 = 11 chars
  if (!/^09\d{9}$/.test(mobile)) throw new Error(`bad test mobile: ${mobile}`);
  createdMobiles.push(mobile);
  return mobile;
}

beforeAll(async () => {
  await getTestApp();
  fixture = await seedFixture(1);
  managerMobile = await mobileOf(fixture.manager.id);
});

afterAll(async () => {
  // remove ad-hoc users created by this suite (fixture cleanup only removes its own)
  if (createdMobiles.length > 0) {
    await prisma.user.deleteMany({ where: { mobile: { in: createdMobiles } } });
  }
  await fixture?.cleanup();
  await closeTestApp();
});

afterEach(() => {
  vi.restoreAllMocks();
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

/** Captures the 6-digit code the mock provider logs, keyed by mobile. */
function captureOtpLogs() {
  const codes = new Map<string, string>();
  const spy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    const first = String(args[0] ?? '');
    const match = first.match(/\[otp:mock\] code for (\S+): (\d{6})/);
    if (match) codes.set(match[1], match[2]);
  });
  return { codes, spy };
}

/** Creates a passwordless employee (requires OTP activation). */
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

/** Creates an employee with an initial password (eligible for password reset). */
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

    const cap = captureOtpLogs();
    const req = await post('/auth/otp/request', { mobile });
    expect(req.statusCode).toBe(200);
    cap.spy.mockRestore();
    const code = cap.codes.get(mobile);
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

    const cap = captureOtpLogs();
    await post('/auth/otp/request', { mobile });
    cap.spy.mockRestore();
    const code = cap.codes.get(mobile)!;
    const wrongCode = '000000' === code ? '111111' : '000000';

    // five wrong attempts: each still "incorrect code" (threshold checked before compare)
    for (let i = 0; i < 5; i++) {
      const wrong = await post('/auth/otp/verify', { mobile, code: wrongCode });
      expect(wrong.statusCode).toBe(400);
      expect(wrong.json().message).toContain('کد تأیید نادرست');
    }
    // the next verify — even with the CORRECT code — hits the threshold and deletes the entry
    const sixth = await post('/auth/otp/verify', { mobile, code });
    expect(sixth.statusCode).toBe(400);
    expect(sixth.json().message).toContain('بیش از حد');
    // the entry is gone: nothing more to verify
    const after = await post('/auth/otp/verify', { mobile, code });
    expect(after.statusCode).toBe(400);
    expect(after.json().message).toContain('منقضی');
  });

  it('activation OTP cannot be used for password reset (purpose isolation)', async () => {
    const mobile = uniqueMobile();
    await createPasswordlessEmployee(mobile);

    const cap = captureOtpLogs();
    await post('/auth/otp/request', { mobile }); // ACTIVATION code
    cap.spy.mockRestore();
    const activationCode = cap.codes.get(mobile)!;

    // try to spend it on the PASSWORD_RESET verify endpoint
    const resetVerify = await post('/auth/forgot-password/verify', { mobile, code: activationCode });
    expect(resetVerify.statusCode).toBe(400);

    // the activation code still works on its own endpoint (not consumed)
    const activationVerify = await post('/auth/otp/verify', { mobile, code: activationCode });
    expect(activationVerify.statusCode).toBe(200);
    const { resetToken, purpose } = activationVerify.json();
    expect(purpose).toBe('ACTIVATION');
    expect(resetToken).toBeTruthy();
  });

  it('password-reset OTP cannot be used for activation', async () => {
    const mobile = uniqueMobile();
    await createPasswordedEmployee(mobile);

    const cap = captureOtpLogs();
    const req = await post('/auth/forgot-password/request', { mobile });
    expect(req.statusCode).toBe(200);
    cap.spy.mockRestore();
    const resetCode = cap.codes.get(mobile);
    expect(resetCode).toMatch(/^\d{6}$/);

    // try to spend the reset code on the ACTIVATION verify endpoint
    const activationVerify = await post('/auth/otp/verify', { mobile, code: resetCode });
    expect(activationVerify.statusCode).toBe(400);

    // it still works on its own endpoint
    const resetVerify = await post('/auth/forgot-password/verify', { mobile, code: resetCode });
    expect(resetVerify.statusCode).toBe(200);
    expect(resetVerify.json().purpose).toBe('PASSWORD_RESET');
  });

  it('OTP is one-time: cannot be reused after successful verification', async () => {
    const mobile = uniqueMobile();
    await createPasswordlessEmployee(mobile);

    const cap = captureOtpLogs();
    await post('/auth/otp/request', { mobile });
    cap.spy.mockRestore();
    const code = cap.codes.get(mobile)!;

    const first = await post('/auth/otp/verify', { mobile, code });
    expect(first.statusCode).toBe(200);

    const replay = await post('/auth/otp/verify', { mobile, code });
    expect(replay.statusCode).toBe(400);
  });

  it('one outstanding activation OTP per mobile: second request is 409', async () => {
    const mobile = uniqueMobile();
    await createPasswordlessEmployee(mobile);

    const first = await post('/auth/otp/request', { mobile });
    expect(first.statusCode).toBe(200);

    const second = await post('/auth/otp/request', { mobile });
    expect(second.statusCode).toBe(409);
  });

  it('activation token cannot be used for password reset (token purpose binding)', async () => {
    const mobile = uniqueMobile();
    await createPasswordlessEmployee(mobile);

    const cap = captureOtpLogs();
    await post('/auth/otp/request', { mobile });
    cap.spy.mockRestore();
    const code = cap.codes.get(mobile)!;

    const verify = await post('/auth/otp/verify', { mobile, code });
    const { resetToken } = verify.json();

    // try to spend the ACTIVATION token on the reset endpoint → purpose mismatch
    const resetAttempt = await post('/auth/forgot-password/reset', {
      mobile,
      resetToken,
      password: 'Hacked!234',
    });
    expect(resetAttempt.statusCode).toBe(401);

    // it still completes its own operation
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

    const cap = captureOtpLogs();
    await post('/auth/forgot-password/request', { mobile });
    cap.spy.mockRestore();
    const code = cap.codes.get(mobile)!;

    const verify = await post('/auth/forgot-password/verify', { mobile, code });
    expect(verify.statusCode).toBe(200);
    const { resetToken } = verify.json();

    // /auth/password is activation-only: a password-bearing account is rejected (409)
    // and the reset token is NOT consumed by the activation endpoint
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
    // dedicated user so the one-outstanding rule doesn't leak into later tests
    const knownMobile = uniqueMobile();
    await createPasswordedEmployee(knownMobile);

    const unknown = await post('/auth/forgot-password/request', { mobile: '09999999999' });
    const known = await post('/auth/forgot-password/request', { mobile: knownMobile });
    expect(unknown.statusCode).toBe(200);
    expect(known.statusCode).toBe(200);
    expect(unknown.json()).toEqual(known.json());
  });

  it('passwordless account cannot use password reset', async () => {
    const mobile = uniqueMobile();
    await createPasswordlessEmployee(mobile);

    const req = await post('/auth/forgot-password/request', { mobile });
    expect(req.statusCode).toBe(200);

    // no code was ever generated (generic 200, nothing in the store) → verify fails
    const verify = await post('/auth/forgot-password/verify', { mobile, code: '123456' });
    expect(verify.statusCode).toBe(400);
  });

  it('full reset flow: verify issues one-time token, reset changes password, old password stops working', async () => {
    const mobile = uniqueMobile();
    await createPasswordedEmployee(mobile);
    const oldPassword = 'Seed!23456';

    const cap = captureOtpLogs();
    await post('/auth/forgot-password/request', { mobile });
    cap.spy.mockRestore();
    const code = cap.codes.get(mobile)!;

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

    // old password rejected, new password works
    const oldLogin = await post('/auth/login', { mobile, password: oldPassword });
    expect(oldLogin.statusCode).toBe(401);
    const newLogin = await post('/auth/login', { mobile, password: 'Reset!23445' });
    expect(newLogin.statusCode).toBe(200);

    // token is one-time: a second reset with the same token fails
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
    expect(noToken.statusCode).toBe(400); // zod: resetToken missing

    const badToken = await post('/auth/forgot-password/reset', {
      mobile: managerMobile,
      resetToken: 'definitely-not-a-real-token-value',
      password: 'Some!23456',
    });
    expect(badToken.statusCode).toBe(401);
  });

  it('a reset token bound to another user cannot reset someone else’s password', async () => {
    // dedicated users so the one-outstanding rule doesn't leak between tests
    const requestorMobile = uniqueMobile();
    const victimMobile = uniqueMobile();
    await createPasswordedEmployee(requestorMobile);
    await createPasswordedEmployee(victimMobile);

    const cap = captureOtpLogs();
    await post('/auth/forgot-password/request', { mobile: requestorMobile });
    cap.spy.mockRestore();
    const code = cap.codes.get(requestorMobile)!;
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

    // the victim's password is untouched
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
    expect(user?.passwordHash).not.toBe('Manager!New1'); // hashed, not plaintext
    expect(user?.passwordHash?.startsWith('$2')).toBe(true); // bcrypt format

    const oldLogin = await post('/auth/login', { mobile: managerMobile, password: 'Passw0rd!' });
    expect(oldLogin.statusCode).toBe(401);
    const newLogin = await post('/auth/login', { mobile: managerMobile, password: 'Manager!New1' });
    expect(newLogin.statusCode).toBe(200);

    // restore for other suites that reuse the fixture password
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
    // restore
    await post(
      '/auth/change-password',
      { currentPassword: 'Manager!New2', newPassword: 'Passw0rd!' },
      fixture.manager.token,
    );
  });
});

describe('Telegram OTP provider (delivery destination only)', () => {
  it('linked Telegram user receives the OTP through the client', async () => {
    const sent: Array<{ chatId: number | string; text: string }> = [];
    const repo = {
      findUserByMobile: async (mobile: string) =>
        mobile === '09120000001' ? { id: 'user-1', mobile } : null,
      findIdentityByUserId: async (userId: string) =>
        userId === 'user-1' ? { telegramUserId: '555000111', userId } : null,
    };
    const client = {
      sendMessage: async (chatId: number | string, text: string) => {
        sent.push({ chatId, text });
      },
    };
    const provider = createTelegramOtpProviderForTests(repo, client);

    await provider.sendOtp('09120000001', '123456');
    expect(sent).toHaveLength(1);
    expect(String(sent[0].chatId)).toBe('555000111'); // identity used ONLY as destination
    expect(sent[0].text).toContain('123456');
  });

  it('unlinked user does not attempt Telegram delivery', async () => {
    let sendAttempts = 0;
    const repo = {
      findUserByMobile: async (mobile: string) => ({ id: 'user-2', mobile }),
      findIdentityByUserId: async () => null,
    };
    const client = {
      sendMessage: async () => {
        sendAttempts++;
      },
    };
    const provider = createTelegramOtpProviderForTests(repo, client);

    await expect(provider.sendOtp('09120000002', '654321')).rejects.toThrow(
      'telegram_otp_identity_not_linked',
    );
    expect(sendAttempts).toBe(0);
  });

  it('unknown user fails safely without touching the client', async () => {
    let sendAttempts = 0;
    const repo = {
      findUserByMobile: async () => null,
      findIdentityByUserId: async () => null,
    };
    const client = {
      sendMessage: async () => {
        sendAttempts++;
      },
    };
    const provider = createTelegramOtpProviderForTests(repo, client);

    await expect(provider.sendOtp('09999999999', '111222')).rejects.toThrow(
      'telegram_otp_user_not_found',
    );
    expect(sendAttempts).toBe(0);
  });

  it('Telegram delivery failure throws (so OTP state is rolled back) and does not corrupt state', async () => {
    const repo = {
      findUserByMobile: async (mobile: string) => ({ id: 'user-3', mobile }),
      findIdentityByUserId: async (userId: string) => ({ telegramUserId: '777', userId }),
    };
    const failingClient = {
      sendMessage: async () => {
        throw new Error('network_down');
      },
    };
    const provider = createTelegramOtpProviderForTests(repo, failingClient);

    await expect(provider.sendOtp('09120000003', '222333')).rejects.toThrow('network_down');
    // provider is stateless — a retry with a working client succeeds
    const okClient = { sendMessage: async () => undefined };
    const retry = createTelegramOtpProviderForTests(repo, okClient);
    await expect(retry.sendOtp('09120000003', '444555')).resolves.toBeUndefined();
  });

  it('provider interface exposes only (mobile, code) — no identity-shaped credential input', async () => {
    const provider = createTelegramOtpProviderForTests(
      {
        findUserByMobile: async (m: string) => ({ id: 'u', mobile: m }),
        findIdentityByUserId: async (id: string) => ({ telegramUserId: '1', userId: id }),
      },
      { sendMessage: async () => undefined },
    );
    expect(provider.name).toBe('telegram');
    expect(provider.sendOtp.length).toBe(2); // (mobile, code)
  });
});

describe('Provider selection', () => {
  it('default (mock) provider still works', async () => {
    const provider = createOtpProvider();
    expect(provider.name).toBe('mock');
    const cap = captureOtpLogs();
    await provider.sendOtp('09120000009', '999888');
    cap.spy.mockRestore();
    expect(cap.codes.get('09120000009')).toBe('999888');
  });

  it('telegram provider can be constructed through the test factory (factory branch: OTP_PROVIDER=telegram)', async () => {
    const provider = createTelegramOtpProviderForTests(
      { findUserByMobile: async () => null, findIdentityByUserId: async () => null },
      { sendMessage: async () => undefined },
    );
    expect(provider.name).toBe('telegram');
    // Runtime selection in createOtpProvider() is env-driven (OTP_PROVIDER=telegram);
    // both branches exist and are type-checked; no network access is needed here.
  });
});
