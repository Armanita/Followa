import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../../lib/errors.js';
import { createOtpProvider } from './otp-providers.js';

const otpProvider = createOtpProvider();

// In-memory OTP store — acceptable for MVP (single instance, ~30 users).
// Entries expire after 5 minutes; 5 wrong attempts invalidate the code.
// Keyed by `mobile|purpose` so a code issued for one purpose can never be
// consumed by another (ACTIVATION vs PASSWORD_RESET).
export type OtpPurpose = 'ACTIVATION' | 'PASSWORD_RESET';

type OtpEntry = { code: string; attempts: number; expiresAt: number };

const otpStore = new Map<string, OtpEntry>();
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const otpKey = (mobile: string, purpose: OtpPurpose) => `${mobile}|${purpose}`;

// One-time operation tokens issued after a successful OTP verification.
// Single registry, purpose-bound: an activation token can never be spent on
// a password reset and vice versa. Each token is one-time and short-lived.
type PendingToken = { userId: string; purpose: OtpPurpose; expiresAt: number };
const pendingTokens = new Map<string, PendingToken>(); // token -> record
const TOKEN_TTL_MS = 10 * 60 * 1000; // short-lived window to finish the operation

async function issueToken(user: { id: string }, purpose: OtpPurpose): Promise<string> {
  const token = await bcrypt.hash(`otp-token:${purpose}:${user.id}:${randomInt(1_000_000_000, 9_999_999_999)}`, 6);
  pendingTokens.set(token, { userId: user.id, purpose, expiresAt: Date.now() + TOKEN_TTL_MS });
  // Opportunistic sweep so the registry never grows unbounded in the MVP's
  // long-running single process.
  const now = Date.now();
  for (const [t, rec] of pendingTokens) {
    if (rec.expiresAt < now) pendingTokens.delete(t);
  }
  return token;
}

function consumeToken(token: string, purpose: OtpPurpose): string {
  const record = pendingTokens.get(token);
  if (!record || record.purpose !== purpose || record.expiresAt < Date.now()) {
    // Do not delete on mismatch/expiry check failure — a stale/foreign token is
    // simply invalid; its record expires naturally with the registry sweep.
    throw unauthorized('توکن تأیید نامعتبر یا منقضی شده است');
  }
  pendingTokens.delete(token);
  return record.userId;
}

/** Shared OTP verification. Returns the verified purpose on success. */
async function verifyOtpCode(rawMobile: string, code: string, purpose: OtpPurpose): Promise<{ mobile: string }> {
  const mobile = normalizeMobile(rawMobile);
  const key = otpKey(mobile, purpose);
  const entry = otpStore.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    throw badRequest('کد تأیید منقضی شده است. دوباره درخواست دهید.');
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(key);
    throw badRequest('تلاش‌های نامعتبر بیش از حد. کد جدید بگیرید.');
  }
  if (entry.code !== code) {
    entry.attempts += 1;
    throw badRequest('کد تأیید نادرست است.');
  }
  otpStore.delete(key); // one-time use: invalidated immediately on success
  return { mobile };
}

/** Generates + stores + delivers an OTP. Caller must have already enforced the
 *  one-outstanding-per-mobile-per-purpose limit. Rolls the entry back if
 *  delivery fails so the user is not locked out by an undelivered code. */
async function issueOtp(mobile: string, purpose: OtpPurpose): Promise<void> {
  const key = otpKey(mobile, purpose);
  const code = String(randomInt(100000, 1000000));
  otpStore.set(key, { code, attempts: 0, expiresAt: Date.now() + OTP_TTL_MS });
  try {
    await otpProvider.sendOtp(mobile, code, purpose);
  } catch (err) {
    otpStore.delete(key);
    throw err;
  }
}

export const authService = {
  async requestOtp(rawMobile: string): Promise<{ isNewUser: boolean }> {
    const mobile = normalizeMobile(rawMobile);
    // Rate limit first (unchanged behavior): one outstanding OTP per mobile/purpose.
    if (otpStore.has(otpKey(mobile, 'ACTIVATION'))) {
      const existing = otpStore.get(otpKey(mobile, 'ACTIVATION'))!;
      if (existing.expiresAt > Date.now()) {
        throw conflict('کد قبلی هنوز معتبر است. کمی صبر کنید.');
      }
    }

    const user = await prisma.user.findUnique({ where: { mobile } });
    if (!user) {
      throw badRequest('این شماره در سیستم ثبت نشده است. با مدیر شرکت تماس بگیرید.');
    }
    const membership = await prisma.companyMembership.findFirst({
      where: { userId: user.id, isActive: true, company: { isActive: true } },
    });
    if (!membership) {
      throw forbidden('عضویت فعالی برای این شماره وجود ندارد.');
    }
    if (user.passwordHash) {
      throw conflict('برای این حساب رمز عبور تعیین شده است. از ورود با رمز استفاده کنید.');
    }

    await issueOtp(mobile, 'ACTIVATION');
    return { isNewUser: true };
  },

  async verifyOtp(
    rawMobile: string,
    code: string,
  ): Promise<{ resetToken: string; purpose: 'ACTIVATION' }> {
    const { mobile } = await verifyOtpCode(rawMobile, code, 'ACTIVATION');

    const user = await prisma.user.findUnique({ where: { mobile } });
    if (!user) throw notFound('کاربر یافت نشد');
    if (user.passwordHash) throw conflict('رمز عبور قبلاً تنظیم شده است');

    const membership = await prisma.companyMembership.findFirst({
      where: { userId: user.id, isActive: true, company: { isActive: true } },
    });
    if (!membership) throw forbidden('عضویت فعال در شرکت فعال یافت نشد.');

    const resetToken = await issueToken(user, 'ACTIVATION');
    return { resetToken, purpose: 'ACTIVATION' };
  },

  async createPassword(
    rawMobile: string,
    resetToken: string,
    password: string,
  ): Promise<void> {
    const mobile = normalizeMobile(rawMobile);
    const user = await prisma.user.findUnique({ where: { mobile } });
    if (!user) throw notFound('کاربر یافت نشد');
    if (user.passwordHash) throw conflict('رمز عبور قبلاً تنظیم شده است');

    const membership = await prisma.companyMembership.findFirst({
      where: { userId: user.id, isActive: true, company: { isActive: true } },
    });
    if (!membership) throw forbidden('عضویت فعال در شرکت فعال یافت نشد.');
    const tokenUserId = consumeToken(resetToken, 'ACTIVATION');
    if (tokenUserId !== user.id) throw unauthorized('توکن تأیید نامعتبر است');
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  },

  // ------------------------------------------------------------------
  // Forgot password (logged-out flow) — PASSWORD_RESET purpose.
  // Responses are intentionally generic to avoid revealing account state.
  // ------------------------------------------------------------------

  async forgotPasswordRequest(rawMobile: string): Promise<void> {
    const mobile = normalizeMobile(rawMobile);
    // Silently ignore ineligible accounts — same generic response either way.
    // The one-outstanding limit is also swallowed (not surfaced as 409) so the
    // endpoint cannot be used to probe whether an account exists.
    const key = otpKey(mobile, 'PASSWORD_RESET');
    if (otpStore.has(key) && otpStore.get(key)!.expiresAt > Date.now()) return;

    const user = await prisma.user.findUnique({ where: { mobile } });
    if (!user || !user.passwordHash) return;
    const membership = await prisma.companyMembership.findFirst({
      where: { userId: user.id, isActive: true, company: { isActive: true } },
    });
    if (!membership) return;

    const code = String(randomInt(100000, 1000000));
    otpStore.set(key, { code, attempts: 0, expiresAt: Date.now() + OTP_TTL_MS });
    try {
      await otpProvider.sendOtp(mobile, code, 'PASSWORD_RESET');
    } catch (err) {
      // Delivery failed — the user never received the code, so the stored
      // entry must not block re-requesting for the next 5 minutes.
      otpStore.delete(key);
      throw err;
    }
  },

  async forgotPasswordVerify(
    rawMobile: string,
    code: string,
  ): Promise<{ resetToken: string; purpose: 'PASSWORD_RESET' }> {
    const { mobile } = await verifyOtpCode(rawMobile, code, 'PASSWORD_RESET');

    const user = await prisma.user.findUnique({ where: { mobile } });
    if (!user || !user.passwordHash) {
      // A code only exists for eligible accounts; reaching here without one
      // is impossible unless state changed — treat as invalid code.
      throw badRequest('کد تأیید نادرست است.');
    }

    const membership = await prisma.companyMembership.findFirst({
      where: { userId: user.id, isActive: true, company: { isActive: true } },
    });
    if (!membership) throw badRequest('کد تأیید نادرست است.');

    const resetToken = await issueToken(user, 'PASSWORD_RESET');
    return { resetToken, purpose: 'PASSWORD_RESET' };
  },

  async forgotPasswordReset(
    rawMobile: string,
    resetToken: string,
    password: string,
  ): Promise<void> {
    const mobile = normalizeMobile(rawMobile);
    const user = await prisma.user.findUnique({ where: { mobile } });
    if (!user) throw unauthorized('توکن تأیید نامعتبر است');

    const membership = await prisma.companyMembership.findFirst({
      where: { userId: user.id, isActive: true, company: { isActive: true } },
    });
    if (!membership) throw unauthorized('توکن تأیید نامعتبر است');
    const tokenUserId = consumeToken(resetToken, 'PASSWORD_RESET');
    if (tokenUserId !== user.id) throw unauthorized('توکن تأیید نامعتبر است');
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  },

  // ------------------------------------------------------------------
  // Self-service password change for logged-in company users.
  // ------------------------------------------------------------------

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw notFound('کاربر یافت نشد');
    if (!user.passwordHash) throw badRequest('برای این حساب رمز عبور تعیین نشده است. از فعال‌سازی با کد یکبارمصرف استفاده کنید.');
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw unauthorized('رمز عبور فعلی نادرست است');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  },

  /** Mobile+password login. Returns the company user with active membership. */
  async loginWithPassword(
    rawMobile: string,
    password: string,
  ): Promise<{
    userId: string;
    membershipId: string;
    companyId: string;
    role: 'COMPANY_MANAGER' | 'EMPLOYEE';
  }> {
    const mobile = normalizeMobile(rawMobile);
    const user = await prisma.user.findUnique({ where: { mobile } });
    if (!user || !user.passwordHash) throw unauthorized('شماره موبایل یا رمز عبور نادرست است');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw unauthorized('شماره موبایل یا رمز عبور نادرست است');

    const membership = await prisma.companyMembership.findFirst({
      where: { userId: user.id, isActive: true, company: { isActive: true } },
      orderBy: { createdAt: 'asc' },
    });
    if (!membership) throw forbidden('عضویت فعال شما در شرکتی وجود ندارد');

    return {
      userId: user.id,
      membershipId: membership.id,
      companyId: membership.companyId,
      role: membership.role,
    };
  },

  /** System admin username/password login. */
  async adminLogin(username: string, password: string): Promise<{ adminId: string }> {
    const admin = await prisma.systemAdmin.findUnique({ where: { username } });
    if (!admin) throw unauthorized('نام کاربری یا رمز عبور نادرست است');
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) throw unauthorized('نام کاربری یا رمز عبور نادرست است');
    return { adminId: admin.id };
  },
};

export function normalizeMobile(input: string): string {
  let v = input.trim().replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  v = v.replace(/[\s-()]/g, '');
  if (/^0098/.test(v)) v = `0${v.slice(4)}`;
  else if (/^\+98/.test(v)) v = `0${v.slice(3)}`;
  else if (/^98\d{10}$/.test(v)) v = `0${v.slice(2)}`;
  else if (/^9\d{9}$/.test(v)) v = `0${v}`;
  if (!/^09\d{9}$/.test(v)) {
    throw badRequest('شماره موبایل معتبر نیست. نمونه: ۰۹۱۲۳۴۵۶۷۸۹');
  }
  return v;
}
