import { createReadStream, createWriteStream, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { parseWith } from '../../lib/validation.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { config } from '../../config.js';
import { changedFields, recordSensitiveAudit } from '../../lib/sensitive-audit.js';
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

const PROFILE_AUDIT_FIELDS = [
  'firstName',
  'lastName',
  'nationalId',
  'birthDate',
  'phone',
  'address',
  'maritalStatus',
  'bankCardNumber',
  'bankIban',
  'bankName',
];

const PERSONNEL_PHOTO_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};
const PERSONNEL_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

function profileUpdateData(body: z.infer<typeof profileSchema>) {
  return {
    ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
    ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
    ...(body.nationalId !== undefined ? { nationalId: body.nationalId } : {}),
    ...(body.birthDate !== undefined
      ? { birthDate: body.birthDate ? new Date(body.birthDate) : null }
      : {}),
    ...(body.phone !== undefined ? { phone: body.phone } : {}),
    ...(body.address !== undefined ? { address: body.address } : {}),
    ...(body.maritalStatus !== undefined ? { maritalStatus: body.maritalStatus } : {}),
    ...(body.bankCardNumber !== undefined ? { bankCardNumber: body.bankCardNumber } : {}),
    ...(body.bankIban !== undefined ? { bankIban: body.bankIban } : {}),
    ...(body.bankName !== undefined ? { bankName: body.bankName } : {}),
  };
}

function publicProfileUser(user: Awaited<ReturnType<typeof prisma.user.findUniqueOrThrow>>) {
  const { passwordHash: _passwordHash, personnelPhotoPath, ...safe } = user;
  return {
    ...safe,
    hasPersonnelPhoto: Boolean(personnelPhotoPath),
  };
}

function missingRequiredProfileFields(user: Awaited<ReturnType<typeof prisma.user.findUniqueOrThrow>>) {
  const required: Array<[string, unknown]> = [
    ['نام', user.firstName],
    ['نام خانوادگی', user.lastName],
    ['کد ملی', user.nationalId],
    ['تاریخ تولد', user.birthDate],
    ['تلفن', user.phone],
    ['آدرس', user.address],
    ['وضعیت تأهل', user.maritalStatus],
    ['شماره کارت', user.bankCardNumber],
    ['شماره شبا', user.bankIban],
    ['نام بانک', user.bankName],
  ];
  return required
    .filter(([, value]) => value === null || value === undefined || (typeof value === 'string' && value.trim() === ''))
    .map(([label]) => label);
}

async function getManagerTargetMembership(companyId: string, membershipId: string) {
  const membership = await prisma.companyMembership.findFirst({
    where: { id: membershipId, companyId },
    include: { user: true, company: true },
  });
  if (!membership) throw notFound('عضو یافت نشد');
  return membership;
}

function removeStoredFile(relativePath: string | null | undefined) {
  if (!relativePath) return;
  const root = path.resolve(config.storageDir);
  const abs = path.resolve(root, relativePath);
  if (abs !== root && abs.startsWith(`${root}${path.sep}`) && existsSync(abs)) {
    try {
      unlinkSync(abs);
    } catch {}
  }
}

async function storePersonnelPhoto(request: FastifyRequest, userId: string) {
  const file = await request.file();
  if (!file) throw badRequest('عکس پرسنلی ارسال نشده است');
  const ext = PERSONNEL_PHOTO_MIME[file.mimetype];
  if (!ext) throw badRequest('عکس پرسنلی باید JPG، PNG یا WebP باشد');

  const root = path.resolve(config.storageDir);
  const dir = path.join(root, 'personnel', userId);
  mkdirSync(dir, { recursive: true });
  const storedName = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${ext}`;
  const abs = path.join(dir, storedName);

  let bytesWritten = 0;
  let tooLarge = false;
  file.file.on('data', (chunk: Buffer) => {
    bytesWritten += chunk.length;
    if (bytesWritten > PERSONNEL_PHOTO_MAX_BYTES && !tooLarge) {
      tooLarge = true;
      file.file.destroy(new Error('PERSONNEL_PHOTO_TOO_LARGE'));
    }
  });

  try {
    await pipeline(file.file, createWriteStream(abs));
  } catch (err) {
    removeStoredFile(path.relative(root, abs));
    if ((err as Error).message === 'PERSONNEL_PHOTO_TOO_LARGE') {
      throw badRequest('حجم عکس پرسنلی نباید بیشتر از ۵ مگابایت باشد');
    }
    throw err;
  }
  if (tooLarge || file.file.truncated) {
    removeStoredFile(path.relative(root, abs));
    throw badRequest('حجم عکس پرسنلی نباید بیشتر از ۵ مگابایت باشد');
  }

  return {
    personnelPhotoFilename: file.filename.slice(0, 200),
    personnelPhotoPath: path.relative(root, abs),
    personnelPhotoMimeType: file.mimetype,
    personnelPhotoSize: bytesWritten,
  };
}

function sendPersonnelPhoto(
  user: {
    personnelPhotoPath: string | null;
    personnelPhotoMimeType: string | null;
    personnelPhotoFilename: string | null;
  },
  reply: FastifyReply,
) {
  if (!user.personnelPhotoPath || !user.personnelPhotoMimeType) {
    throw notFound('عکس پرسنلی ثبت نشده است');
  }
  const root = path.resolve(config.storageDir);
  const abs = path.resolve(root, user.personnelPhotoPath);
  if (abs === root || !abs.startsWith(`${root}${path.sep}`) || !existsSync(abs)) {
    throw notFound('فایل عکس پرسنلی یافت نشد');
  }
  reply.header('Content-Type', user.personnelPhotoMimeType);
  reply.header(
    'Content-Disposition',
    `inline; filename="${encodeURIComponent(user.personnelPhotoFilename ?? 'personnel-photo')}"`,
  );
  return reply.send(createReadStream(abs));
}

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

  /** List members of my company. */
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
        profileFinalizedAt: m.user.profileFinalizedAt,
        hasPersonnelPhoto: Boolean(m.user.personnelPhotoPath),
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
    return { message: 'رمز عبور بازنشانی شد' };
  });

  /** Manager-only personnel profile view/edit, scoped to the current company. */
  app.get('/members/:membershipId/profile', async (request) => {
    if (request.actor.role !== 'COMPANY_MANAGER') {
      throw forbidden('فقط مدیر می‌تواند اطلاعات پرسنلی کارکنان را مشاهده کند');
    }
    const { membershipId } = request.params as { membershipId: string };
    const membership = await getManagerTargetMembership(request.actor.companyId!, membershipId);
    return {
      user: publicProfileUser(membership.user),
      membership: {
        id: membership.id,
        role: membership.role,
        isActive: membership.isActive,
        jobTitle: membership.jobTitle,
        employeeCode: membership.employeeCode,
      },
      company: { id: membership.company.id, name: membership.company.name },
    };
  });

  app.patch('/members/:membershipId/profile', async (request) => {
    if (request.actor.role !== 'COMPANY_MANAGER') {
      throw forbidden('فقط مدیر می‌تواند اطلاعات پرسنلی کارکنان را ویرایش کند');
    }
    const { membershipId } = request.params as { membershipId: string };
    const membership = await getManagerTargetMembership(request.actor.companyId!, membershipId);
    const body = parseWith(profileSchema, request.body);
    const before = membership.user;
    const updated = await prisma.user.update({
      where: { id: membership.userId },
      data: profileUpdateData(body),
    });
    const fields = changedFields(
      before as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
      PROFILE_AUDIT_FIELDS,
    );
    if (fields.length > 0) {
      await recordSensitiveAudit({
        companyId: request.actor.companyId!,
        actorId: request.actor.id,
        entityType: 'USER_PROFILE',
        entityId: updated.id,
        action: 'MANAGER_PROFILE_UPDATE',
        changedFields: fields,
      });
    }
    return { message: 'اطلاعات پرسنلی به‌روزرسانی شد', user: publicProfileUser(updated) };
  });

  app.get('/members/:membershipId/photo', async (request, reply) => {
    if (request.actor.role !== 'COMPANY_MANAGER') {
      throw forbidden('فقط مدیر می‌تواند عکس پرسنلی کارکنان را مشاهده کند');
    }
    const { membershipId } = request.params as { membershipId: string };
    const membership = await getManagerTargetMembership(request.actor.companyId!, membershipId);
    return sendPersonnelPhoto(membership.user, reply);
  });

  app.post('/members/:membershipId/photo', async (request) => {
    if (request.actor.role !== 'COMPANY_MANAGER') {
      throw forbidden('فقط مدیر می‌تواند عکس پرسنلی کارکنان را تغییر دهد');
    }
    const { membershipId } = request.params as { membershipId: string };
    const membership = await getManagerTargetMembership(request.actor.companyId!, membershipId);
    const stored = await storePersonnelPhoto(request, membership.userId);
    const updated = await prisma.user.update({
      where: { id: membership.userId },
      data: stored,
    });
    removeStoredFile(membership.user.personnelPhotoPath);
    await recordSensitiveAudit({
      companyId: request.actor.companyId!,
      actorId: request.actor.id,
      entityType: 'USER_PROFILE',
      entityId: updated.id,
      action: 'MANAGER_PERSONNEL_PHOTO_UPDATE',
      changedFields: ['personnelPhoto'],
    });
    return { message: 'عکس پرسنلی به‌روزرسانی شد', user: publicProfileUser(updated) };
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
    return {
      user: publicProfileUser(user),
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
    const before = await prisma.user.findUnique({ where: { id: userId } });
    if (!before) throw notFound('کاربر یافت نشد');
    if (request.actor.role === 'EMPLOYEE' && before.profileFinalizedAt) {
      throw forbidden('اطلاعات پرسنلی شما ثبت نهایی شده و فقط مدیر می‌تواند آن را ویرایش کند');
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data: profileUpdateData(body),
    });
    const fields = changedFields(
      before as unknown as Record<string, unknown>,
      user as unknown as Record<string, unknown>,
      PROFILE_AUDIT_FIELDS,
    );
    if (fields.length > 0) {
      await recordSensitiveAudit({
        companyId: request.actor.companyId!,
        actorId: request.actor.id,
        entityType: 'USER_PROFILE',
        entityId: user.id,
        action: request.actor.role === 'COMPANY_MANAGER' ? 'MANAGER_SELF_PROFILE_UPDATE' : 'EMPLOYEE_PROFILE_UPDATE',
        changedFields: fields,
      });
    }
    return { message: 'پروفایل به‌روزرسانی شد', user: publicProfileUser(user) };
  });

  app.post('/profile/finalize', async (request) => {
    if (request.actor.role !== 'EMPLOYEE') {
      throw forbidden('ثبت نهایی اطلاعات برای پروفایل کارمند است');
    }
    const user = await prisma.user.findUnique({ where: { id: request.actor.id } });
    if (!user) throw notFound('کاربر یافت نشد');
    if (user.profileFinalizedAt) throw conflict('اطلاعات پرسنلی قبلاً ثبت نهایی شده است');
    const missing = missingRequiredProfileFields(user);
    if (missing.length > 0) {
      throw badRequest(`برای ثبت نهایی این موارد را تکمیل کنید: ${missing.join('، ')}`);
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { profileFinalizedAt: new Date() },
    });
    await recordSensitiveAudit({
      companyId: request.actor.companyId!,
      actorId: request.actor.id,
      entityType: 'USER_PROFILE',
      entityId: user.id,
      action: 'EMPLOYEE_PROFILE_FINALIZED',
      changedFields: ['profileFinalizedAt'],
    });
    return {
      message: 'اطلاعات پرسنلی ثبت نهایی شد. از این پس تغییرات فقط توسط مدیر انجام می‌شود.',
      user: publicProfileUser(updated),
    };
  });

  app.get('/profile/photo', async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.actor.id } });
    if (!user) throw notFound('کاربر یافت نشد');
    return sendPersonnelPhoto(user, reply);
  });

  app.post('/profile/photo', async (request) => {
    const user = await prisma.user.findUnique({ where: { id: request.actor.id } });
    if (!user) throw notFound('کاربر یافت نشد');
    if (request.actor.role === 'EMPLOYEE' && user.profileFinalizedAt) {
      throw forbidden('پس از ثبت نهایی، تغییر عکس پرسنلی فقط توسط مدیر انجام می‌شود');
    }
    const stored = await storePersonnelPhoto(request, user.id);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: stored,
    });
    removeStoredFile(user.personnelPhotoPath);
    await recordSensitiveAudit({
      companyId: request.actor.companyId!,
      actorId: request.actor.id,
      entityType: 'USER_PROFILE',
      entityId: user.id,
      action: request.actor.role === 'COMPANY_MANAGER' ? 'MANAGER_SELF_PERSONNEL_PHOTO_UPDATE' : 'EMPLOYEE_PERSONNEL_PHOTO_UPDATE',
      changedFields: ['personnelPhoto'],
    });
    return { message: 'عکس پرسنلی ذخیره شد', user: publicProfileUser(updated) };
  });
}
