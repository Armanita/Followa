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
        memberships: { where: { role: 'COMPANY_MANAGER' }, include: { user: true } },
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
          fullName: `${m.user.firstName} ${m.user.lastName}`,
          mobile: m.user.mobile,
          isActive: m.isActive,
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
