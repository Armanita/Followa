import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../../lib/errors.js';
import { createOtpProvider } from './otp-providers.js';

const otpProvider = createOtpProvider();

// In-memory OTP store — acceptable for MVP (single instance, ~30 users).
// Entries expire after 5 minutes; 5 wrong attempts invalidate the code.
const otpStore = new Map<string, { code: string; attempts: number; expiresAt: number }>();
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export const authService = {
  async requestOtp(rawMobile: string): Promise<{ isNewUser: boolean }> {
    const mobile = normalizeMobile(rawMobile);

    // Rate limit: one outstanding OTP per mobile.
    if (otpStore.has(mobile) && otpStore.get(mobile)!.expiresAt > Date.now()) {
      throw conflict('کد قبلی هنوز معتبر است. کمی صبر کنید.');
    }

    const user = await prisma.user.findUnique({ where: { mobile } });
    if (!user) {
      throw badRequest('این شماره در سیستم ثبت نشده است. با مدیر شرکت تماس بگیرید.');
    }
    const membership = await prisma.companyMembership.findFirst({
      where: { userId: user.id, isActive: true },
    });
    if (!membership) {
      throw forbidden('عضویت فعالی برای این شماره وجود ندارد.');
    }
    if (user.passwordHash) {
      throw conflict('برای این حساب رمز عبور تعیین شده است. از ورود با رمز استفاده کنید.');
    }

    const code = String(randomInt(100000, 1000000));
    otpStore.set(mobile, { code, attempts: 0, expiresAt: Date.now() + OTP_TTL_MS });
    await otpProvider.sendOtp(mobile, code);
    return { isNewUser: true };
  },

  async verifyOtp(
    rawMobile: string,
    code: string,
  ): Promise<{ resetToken: string }> {
    const mobile = normalizeMobile(rawMobile);
    const entry = otpStore.get(mobile);
    if (!entry || entry.expiresAt < Date.now()) {
      throw badRequest('کد تأیید منقضی شده است. دوباره درخواست دهید.');
    }
    if (entry.attempts >= MAX_ATTEMPTS) {
      otpStore.delete(mobile);
      throw badRequest('تلاش‌های نامعتبر بیش از حد. کد جدید بگیرید.');
    }
    if (entry.code !== code) {
      entry.attempts += 1;
      throw badRequest('کد تأیید نادرست است.');
    }
    otpStore.delete(mobile);

    // One-time token authorizes exactly one password creation for this mobile.
    const user = await prisma.user.findUnique({ where: { mobile } });
    if (!user) throw notFound('کاربر یافت نشد');
    if (user.passwordHash) throw conflict('رمز عبور قبلاً تنظیم شده است');

    const resetToken = await bcrypt.hash(`pwd-setup:${user.id}:${user.createdAt.toISOString()}`, 6);
    pendingSetupTokens.set(user.id, resetToken);
    return { resetToken };
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
    if (pendingSetupTokens.get(user.id) !== resetToken) {
      throw unauthorized('توکن تأیید نامعتبر است');
    }
    pendingSetupTokens.delete(user.id);
    const passwordHash = await bcrypt.hash(password, 10);
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
      where: { userId: user.id, isActive: true },
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

const pendingSetupTokens = new Map<string, string>();

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
