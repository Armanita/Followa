import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { parseWith } from '../../lib/validation.js';
import { conflict, forbidden, notFound } from '../../lib/errors.js';
import { normalizeMobile } from '../auth/auth-service.js';

const createMemberSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  mobile: z.string().min(10).max(20),
  role: z.enum(['COMPANY_MANAGER', 'EMPLOYEE']),
  jobTitle: z.string().max(80).optional(),
  employeeCode: z.string().max(30).optional(),
  // optional initial password; otherwise user sets one via OTP flow
  password: z.string().min(8).max(72).optional(),
});

const updateMemberSchema = z.object({
  isActive: z.boolean().optional(),
  jobTitle: z.string().max(80).nullable().optional(),
  employeeCode: z.string().max(30).nullable().optional(),
});

const profileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  nationalId: z.string().regex(/^\d{10}$/, 'کد ملی باید ۱۰ رقم باشد').nullable().optional(),
  birthDate: z.string().datetime().nullable().optional(),
  phone: z.string().max(15).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  maritalStatus: z.enum(['SINGLE', 'MARRIED']).nullable().optional(),
  bankCardNumber: z.string().max(24).nullable().optional(),
  bankIban: z.string().max(26).nullable().optional(),
  bankName: z.string().max(50).nullable().optional(),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8).max(72),
});

export async function memberRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', async (request) => {
    if (request.actor?.kind === 'COMPANY_USER') {
      const membership = await prisma.companyMembership.findUnique({
        where: { id: request.actor.membershipId },
      });
      if (!membership || !membership.isActive) {
        throw forbidden('عضویت شما غیرفعال است. با مدیر شرکت تماس بگیرید.');
      }
      request.actor.role = membership.role;
    }
  });

  /** List members of my company. Manager sees all; employee gets company case-types too. */
  app.get('/members', async (request) => {
    if (request.actor.role !== 'COMPANY_MANAGER') {
      throw forbidden('این بخش مخصوص مدیر شرکت است');
    }
    const companyId = request.actor.companyId!;
    const memberships = await prisma.companyMembership.findMany({
      where: { companyId },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      include: { user: true },
    });
    return {
      items: memberships.map((m) => ({
        membershipId: m.id,
        userId: m.user.id,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        fullName: `${m.user.firstName} ${m.user.lastName}`,
        mobile: m.user.mobile,
        role: m.role,
        isActive: m.isActive,
        hasPassword: Boolean(m.user.passwordHash),
        jobTitle: m.jobTitle,
        employeeCode: m.employeeCode,
        createdAt: m.createdAt,
      })),
    };
  });

  app.post('/members', async (request) => {
    if (request.actor.role !== 'COMPANY_MANAGER') {
      throw forbidden('فقط مدیر می‌تواند کارمند اضافه کند');
    }
    const companyId = request.actor.companyId!;
    const body = parseWith(createMemberSchema, request.body);
    const mobile = normalizeMobile(body.mobile);

    let user = await prisma.user.findUnique({ where: { mobile } });
    if (user) {
      const existing = await prisma.companyMembership.findUnique({
        where: { userId_companyId: { userId: user.id, companyId } },
      });
      if (existing) throw conflict('این کاربر از قبل عضو شرکت است');
    }

    const passwordHash = body.password ? await bcrypt.hash(body.password, 10) : null;

    user = await prisma.$transaction(async (tx) => {
      const ensured =
        user ??
        (await tx.user.create({
          data: {
            mobile,
            firstName: body.firstName,
            lastName: body.lastName,
            ...(passwordHash ? { passwordHash } : {}),
          },
        }));
      await tx.companyMembership.create({
        data: {
          userId: ensured.id,
          companyId,
          role: body.role,
          jobTitle: body.jobTitle,
          employeeCode: body.employeeCode,
        },
      });
      return ensured;
    });

    return {
      message: body.password
        ? 'کارمند ساخته شد و می‌تواند با رمز عبور اولیه وارد شود'
        : 'کارمند ساخته شد. برای تعیین رمز، ثبت‌نام با کد یکبارمصرف انجام می‌شود.',
      userId: user.id,
      requiresOtpSignup: !passwordHash,
    };
  });

  app.patch('/members/:membershipId', async (request) => {
    if (request.actor.role !== 'COMPANY_MANAGER') {
      throw forbidden('فقط مدیر می‌تواند وضعیت کارکنان را تغییر دهد');
    }
    const companyId = request.actor.companyId!;
    const { membershipId } = request.params as { membershipId: string };
    const body = parseWith(updateMemberSchema, request.body);

    const membership = await prisma.companyMembership.findFirst({
      where: { id: membershipId, companyId },
    });
    if (!membership) throw notFound('عضو یافت نشد');
    if (membership.id === request.actor.membershipId && body.isActive === false) {
      throw conflict('مدیر نمی‌تواند عضویت خودش را غیرفعال کند');
    }

    const updated = await prisma.companyMembership.update({
      where: { id: membershipId },
      data: {
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.jobTitle !== undefined ? { jobTitle: body.jobTitle } : {}),
        ...(body.employeeCode !== undefined ? { employeeCode: body.employeeCode } : {}),
      },
    });
    return { message: 'اطلاعات عضو به‌روزرسانی شد', membership: updated };
  });

  app.post('/members/:membershipId/reset-password', async (request) => {
    if (request.actor.role !== 'COMPANY_MANAGER') {
      throw forbidden('فقط مدیر می‌تواند رمز را بازنشانی کند');
    }
    const companyId = request.actor.companyId!;
    const { membershipId } = request.params as { membershipId: string };
    const body = parseWith(resetPasswordSchema, request.body);

    const membership = await prisma.companyMembership.findFirst({
      where: { id: membershipId, companyId },
      include: { user: true },
    });
    if (!membership) throw notFound('عضو یافت نشد');

    const passwordHash = await bcrypt.hash(body.newPassword, 10);
    await prisma.user.update({
      where: { id: membership.userId },
      data: { passwordHash },
    });
    // Force OTP re-setup next time the manager clears a password? Not needed:
    // new password is immediately valid.
    return { message: 'رمز عبور بازنشانی شد' };
  });

  /** Own profile (any active member). */
  app.get('/profile', async (request) => {
    const userId = request.actor.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw notFound('کاربر یافت نشد');
    const membership = await prisma.companyMembership.findUnique({
      where: { id: request.actor.membershipId },
      include: { company: true },
    });
    const { passwordHash: _ph, ...safeUser } = user;
    return {
      user: safeUser,
      company: membership?.company
        ? { id: membership.company.id, name: membership.company.name }
        : null,
      role: membership?.role,
      jobTitle: membership?.jobTitle,
      employeeCode: membership?.employeeCode,
    };
  });

  app.patch('/profile', async (request) => {
    const userId = request.actor.id;
    const body = parseWith(profileSchema, request.body);
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
        ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
        ...(body.nationalId !== undefined ? { nationalId: body.nationalId } : {}),
        ...(body.birthDate !== undefined
          ? { birthDate: body.birthDate ? new Date(body.birthDate) : null }
          : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.address !== undefined ? { address: body.address } : {}),
        ...(body.maritalStatus !== undefined ? { maritalStatus: body.maritalStatus } : {}),
        ...(body.bankCardNumber !== undefined
          ? { bankCardNumber: body.bankCardNumber }
          : {}),
        ...(body.bankIban !== undefined ? { bankIban: body.bankIban } : {}),
        ...(body.bankName !== undefined ? { bankName: body.bankName } : {}),
      },
    });
    const { passwordHash: _ph, ...safeUser } = user;
    return { message: 'پروفایل به‌روزرسانی شد', user: safeUser };
  });
}
