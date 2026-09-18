import { MessagingChannel, MessagingIdentityStatus } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { parseWith } from '../../lib/validation.js';
import { conflict, notFound } from '../../lib/errors.js';
import { normalizeMobile } from '../auth/auth-service.js';

const createCompanySchema = z.object({
  name: z.string().min(2).max(100),
  manager: z.object({
    firstName: z.string().min(1).max(50),
    lastName: z.string().min(1).max(50),
    mobile: z.string().min(10).max(20),
    password: z.string().min(8).max(72),
    jobTitle: z.string().max(80).optional(),
  }),
});

const updateCompanySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  manager: z.object({
    userId: z.string().min(1),
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    mobile: z.string().min(10).max(20).optional(),
    jobTitle: z.string().max(80).nullable().optional(),
  }).optional(),
});

const replaceManagerSchema = z.object({
  newManager: z.object({
    firstName: z.string().min(1).max(50),
    lastName: z.string().min(1).max(50),
    mobile: z.string().min(10).max(20),
    jobTitle: z.string().max(80).optional(),
    password: z.string().min(8).max(72).optional(),
  }),
});

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // All routes here are system-admin only (checked per route because the global
  // hook only enforces token presence).
  app.addHook('preHandler', async (request, reply) => {
    if (request.actor?.kind !== 'SYSTEM_ADMIN') {
      return reply.status(403).send({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'این بخش مخصوص مدیر سیستم است',
      });
    }
  });

  app.get('/companies', async () => {
    const companies = await prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        memberships: {
          where: { role: 'COMPANY_MANAGER' },
          include: {
            user: {
              include: {
                messagingIdentities: {
                  where: { channel: MessagingChannel.TELEGRAM },
                },
              },
            },
          },
        },
        _count: { select: { cases: true, memberships: true } },
      },
    });
    return {
      items: companies.map((c) => ({
        id: c.id,
        name: c.name,
        isActive: c.isActive,
        createdAt: c.createdAt,
        managers: c.memberships.map((m) => ({
          id: m.user.id,
          userId: m.user.id,
          membershipId: m.id,
          firstName: m.user.firstName,
          lastName: m.user.lastName,
          fullName: `${m.user.firstName} ${m.user.lastName}`,
          mobile: m.user.mobile,
          jobTitle: m.jobTitle,
          isActive: m.isActive,
          telegramConnected: m.user.messagingIdentities.some(
            (identity) =>
              identity.status === MessagingIdentityStatus.ACTIVE &&
              Boolean(identity.verifiedAt),
          ),
          hasPassword: Boolean(m.user.passwordHash),
        })),
        memberCount: c._count.memberships,
        caseCount: c._count.cases,
      })),
    };
  });

  app.post('/companies', async (request) => {
    const body = parseWith(createCompanySchema, request.body);
    const mobile = normalizeMobile(body.manager.mobile);

    const existingUser = await prisma.user.findUnique({ where: { mobile } });
    if (existingUser && existingUser.passwordHash) {
      throw conflict('کاربری با این شماره موبایل و رمز عبور از قبل وجود دارد');
    }

    const passwordHash = await bcrypt.hash(body.manager.password, 10);

    const company = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({ data: { name: body.name } });

      await tx.caseType.createMany({
        data: [
          { companyId: company.id, name: 'پیگیری مشتری', color: '#2563eb' },
          { companyId: company.id, name: 'قرارداد', color: '#7c3aed' },
          { companyId: company.id, name: 'پشتیبانی', color: '#059669' },
          { companyId: company.id, name: 'اداری', color: '#d97706' },
        ],
      });

      const user =
        existingUser ??
        (await tx.user.create({
          data: {
            mobile,
            firstName: body.manager.firstName,
            lastName: body.manager.lastName,
            passwordHash,
          },
        }));

      await tx.companyMembership.create({
        data: {
          userId: user.id,
          companyId: company.id,
          role: 'COMPANY_MANAGER',
          jobTitle: body.manager.jobTitle ?? 'مدیر شرکت',
        },
      });

      return company;
    });

    return { message: 'شرکت و مدیر آن ساخته شد', companyId: company.id };
  });

  app.post('/companies/:companyId/managers/:membershipId/replace', async (request) => {
    const { companyId, membershipId } = request.params as {
      companyId: string;
      membershipId: string;
    };
    const body = parseWith(replaceManagerSchema, request.body);
    const mobile = normalizeMobile(body.newManager.mobile);
    const passwordHash = body.newManager.password
      ? await bcrypt.hash(body.newManager.password, 10)
      : null;

    await prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { id: true },
      });
      if (!company) throw notFound('شرکت یافت نشد');

      const oldMembership = await tx.companyMembership.findFirst({
        where: {
          id: membershipId,
          companyId,
          role: 'COMPANY_MANAGER',
        },
        select: { id: true, userId: true, isActive: true },
      });
      if (!oldMembership) throw notFound('عضویت مدیر شرکت یافت نشد');
      if (!oldMembership.isActive) {
        throw conflict('این مدیر قبلاً غیرفعال شده است');
      }

      const existingUser = await tx.user.findUnique({
        where: { mobile },
        select: { id: true },
      });
      if (existingUser) {
        if (existingUser.id === oldMembership.userId) {
          throw conflict('برای اصلاح اطلاعات همین مدیر از «ویرایش» استفاده کنید');
        }
        throw conflict('کاربری با این شماره موبایل از قبل وجود دارد');
      }

      const newUser = await tx.user.create({
        data: {
          firstName: body.newManager.firstName,
          lastName: body.newManager.lastName,
          mobile,
          passwordHash,
        },
      });

      await tx.companyMembership.create({
        data: {
          userId: newUser.id,
          companyId,
          role: 'COMPANY_MANAGER',
          isActive: true,
          jobTitle: body.newManager.jobTitle ?? 'مدیر شرکت',
        },
      });

      await tx.companyMembership.update({
        where: { id: oldMembership.id },
        data: { isActive: false },
      });
    });

    return { message: 'مدیر شرکت با موفقیت جایگزین شد' };
  });

  app.patch('/companies/:id', async (request) => {
    const { id } = request.params as { id: string };
    const body = parseWith(updateCompanySchema, request.body);
    const normalizedMobile = body.manager?.mobile !== undefined
      ? normalizeMobile(body.manager.mobile)
      : undefined;

    await prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({ where: { id }, select: { id: true } });
      if (!company) throw notFound('شرکت یافت نشد');

      let managerMembership: { id: string; userId: string } | null = null;
      if (body.manager) {
        managerMembership = await tx.companyMembership.findFirst({
          where: {
            companyId: id,
            userId: body.manager.userId,
            role: 'COMPANY_MANAGER',
          },
          select: { id: true, userId: true },
        });
        if (!managerMembership) throw notFound('مدیر شرکت یافت نشد');

        if (normalizedMobile !== undefined) {
          const existingMobileOwner = await tx.user.findUnique({
            where: { mobile: normalizedMobile },
            select: { id: true },
          });
          if (existingMobileOwner && existingMobileOwner.id !== body.manager.userId) {
            throw conflict('کاربری با این شماره موبایل از قبل وجود دارد');
          }
        }
      }

      if (body.name !== undefined) {
        await tx.company.update({ where: { id }, data: { name: body.name } });
      }

      if (body.manager && managerMembership) {
        const userData: {
          firstName?: string;
          lastName?: string;
          mobile?: string;
        } = {};
        if (body.manager.firstName !== undefined) userData.firstName = body.manager.firstName;
        if (body.manager.lastName !== undefined) userData.lastName = body.manager.lastName;
        if (normalizedMobile !== undefined) userData.mobile = normalizedMobile;

        if (Object.keys(userData).length > 0) {
          await tx.user.update({
            where: { id: body.manager.userId },
            data: userData,
          });
        }

        if (body.manager.jobTitle !== undefined) {
          await tx.companyMembership.update({
            where: { id: managerMembership.id },
            data: { jobTitle: body.manager.jobTitle },
          });
        }
      }
    });

    return { message: 'اطلاعات شرکت و مدیر به‌روزرسانی شد' };
  });

  app.patch('/companies/:id/active', async (request) => {
    const { id } = request.params as { id: string };
    const body = parseWith(z.object({ isActive: z.boolean() }), request.body);
    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) throw notFound('شرکت یافت نشد');
    await prisma.company.update({ where: { id }, data: { isActive: body.isActive } });
    return { message: body.isActive ? 'شرکت فعال شد' : 'شرکت غیرفعال شد' };
  });

  app.get('/stats', async () => {
    const [companyCount, userCount, caseCount] = await Promise.all([
      prisma.company.count(),
      prisma.user.count(),
      prisma.case.count(),
    ]);
    return { companyCount, userCount, caseCount };
  });
}
