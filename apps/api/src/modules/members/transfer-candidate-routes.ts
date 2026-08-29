import type { FastifyInstance } from 'fastify';
import { forbidden } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

/**
 * Minimal company-scoped directory used only for case transfers.
 * It intentionally exposes no mobile number or personnel/sensitive fields.
 */
export async function transferCandidateRoutes(app: FastifyInstance): Promise<void> {
  app.get('/members/transfer-candidates', async (request) => {
    if (request.actor?.kind !== 'COMPANY_USER' || !request.actor.companyId || !request.actor.membershipId) {
      throw forbidden('دسترسی به فهرست همکاران مجاز نیست');
    }

    const caller = await prisma.companyMembership.findFirst({
      where: {
        id: request.actor.membershipId,
        companyId: request.actor.companyId,
        userId: request.actor.id,
        isActive: true,
      },
      select: { id: true },
    });
    if (!caller) {
      throw forbidden('عضویت شما غیرفعال است. با مدیر شرکت تماس بگیرید.');
    }

    const memberships = await prisma.companyMembership.findMany({
      where: {
        companyId: request.actor.companyId,
        isActive: true,
        role: 'EMPLOYEE',
        userId: { not: request.actor.id },
      },
      orderBy: [{ createdAt: 'asc' }],
      select: {
        jobTitle: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return {
      items: memberships.map((membership) => ({
        userId: membership.user.id,
        fullName: `${membership.user.firstName} ${membership.user.lastName}`,
        jobTitle: membership.jobTitle,
      })),
    };
  });
}
