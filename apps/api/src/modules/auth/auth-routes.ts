import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { parseWith } from '../../lib/validation.js';
import { authService, normalizeMobile } from './auth-service.js';

const mobileSchema = z.object({
  mobile: z.string().min(10).max(20),
});

const otpSchema = z.object({
  mobile: z.string().min(10).max(20),
  code: z.string().regex(/^\d{6}$/, 'کد تأیید باید ۶ رقم باشد'),
});

const passwordSetupSchema = z.object({
  mobile: z.string().min(10).max(20),
  resetToken: z.string().min(10),
  password: z.string().min(8, 'رمز عبور حداقل ۸ کاراکتر باشد').max(72),
});

const loginSchema = z.object({
  mobile: z.string().min(10).max(20),
  password: z.string().min(1),
});

const adminLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/otp/request', async (request) => {
    const { mobile } = parseWith(mobileSchema, request.body);
    const result = await authService.requestOtp(mobile);
    return {
      message: 'کد تأیید ارسال شد',
      isNewUser: result.isNewUser,
      // mock provider surfaces the code so the flow is testable without an SMS gateway
      ...(process.env.OTP_PROVIDER === 'mock' || !process.env.OTP_PROVIDER
        ? {}
        : {}),
    };
  });

  app.post('/auth/otp/verify', async (request) => {
    const body = parseWith(otpSchema, request.body);
    return authService.verifyOtp(body.mobile, body.code);
  });

  app.post('/auth/password', async (request) => {
    const body = parseWith(passwordSetupSchema, request.body);
    await authService.createPassword(body.mobile, body.resetToken, body.password);
    return { message: 'رمز عبور ساخته شد. اکنون می‌توانید وارد شوید.' };
  });

  app.post('/auth/login', async (request, reply) => {
    const body = parseWith(loginSchema, request.body);
    const session = await authService.loginWithPassword(body.mobile, body.password);
    const token = app.jwt.sign(
      {
        sub: session.userId,
        kind: 'COMPANY_USER' as const,
        membershipId: session.membershipId,
        companyId: session.companyId,
        role: session.role,
      },
      { expiresIn: process.env.JWT_EXPIRES_IN ?? '12h' },
    );
    const user = await requireUser(session.userId);
    reply.send({ token, user });
  });

  app.post('/auth/admin/login', async (request, reply) => {
    const body = parseWith(adminLoginSchema, request.body);
    const { adminId } = await authService.adminLogin(body.username, body.password);
    const token = app.jwt.sign(
      { sub: adminId, kind: 'SYSTEM_ADMIN' as const },
      { expiresIn: '8h' },
    );
    const admin = await prisma.systemAdmin.findUniqueOrThrow({
      where: { id: adminId },
      select: { id: true, username: true },
    });
    reply.send({ token, admin });
  });
}

async function requireUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      mobile: true,
      firstName: true,
      lastName: true,
      memberships: {
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: { id: true, companyId: true, role: true },
      },
    },
  });
  if (!user) throw new Error('user vanished');
  const m = user.memberships[0];
  return {
    id: user.id,
    mobile: user.mobile,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`,
    role: m?.role ?? null,
    companyId: m?.companyId ?? null,
  };
}

// keep normalizeMobile exported for reuse in other modules
export { normalizeMobile };
