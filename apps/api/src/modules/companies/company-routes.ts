import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';

export async function companyRoutes(app: FastifyInstance): Promise<void> {
  /** Company basics + case types for the current user's company. */
  app.get('/companies/current', async (request) => {
    const companyId = request.actor.companyId!;
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      include: { caseTypes: { where: { isActive: true }, orderBy: { name: 'asc' } } },
    });
    return {
      id: company.id,
      name: company.name,
      caseTypes: company.caseTypes.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
      })),
    };
  });

  app.post('/case-types', async (request, reply) => {
    if (request.actor.role !== 'COMPANY_MANAGER') {
      return reply.status(403).send({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'فقط مدیر می‌تواند نوع پرونده بسازد',
      });
    }
    const companyId = request.actor.companyId!;
    const body = z
      .object({
        name: z.string().min(2).max(50),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      })
      .parse(request.body);
    const type = await prisma.caseType.create({
      data: { companyId, name: body.name, color: body.color },
    });
    return { message: 'نوع پرونده ساخته شد', caseType: type };
  });
}
