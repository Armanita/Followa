import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseWith } from '../../lib/validation.js';
import { assignmentService } from './assignment-service.js';
import { prisma } from '../../lib/prisma.js';

const transferSchema = z.object({
  toUserId: z.string().min(1),
  note: z.string().max(1000).optional(),
});

const rejectSchema = z.object({
  reason: z.string().min(3, 'دلیل رد کردن الزامی است').max(1000),
});

export async function assignmentRoutes(app: FastifyInstance): Promise<void> {
  /** Cases waiting for MY acceptance. */
  app.get('/assignments/pending', async (request) => {
    const userId = request.actor.id;
    const items = await prisma.caseAssignment.findMany({
      where: { toUserId: userId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: {
        case: {
          include: {
            createdBy: { select: { id: true, firstName: true, lastName: true } },
            caseType: { select: { name: true, color: true } },
          },
        },
        fromUs: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    return {
      items: items
        .filter((a) => a.case.status === 'WAITING_ACCEPTANCE')
        .map((a) => ({
          assignmentId: a.id,
          createdAt: a.createdAt,
          note: a.note,
          from: a.fromUs,
          case: {
            id: a.case.id,
            number: a.case.number,
            title: a.case.title,
            description: a.case.description,
            priority: a.case.priority,
            dueDate: a.case.dueDate,
            status: a.case.status,
            createdBy: a.case.createdBy,
            caseType: a.case.caseType,
          },
        })),
    };
  });

  app.post('/cases/:id/transfer', async (request) => {
    const body = parseWith(transferSchema, request.body);
    const assignment = await assignmentService.transfer(
      {
        userId: request.actor.id,
        companyId: request.actor.companyId!,
        role: request.actor.role!,
      },
      (request.params as { id: string }).id,
      body.toUserId,
      body.note,
    );
    return { message: 'پرونده ارجاع شد', assignmentId: assignment.id };
  });

  app.post('/cases/:id/accept', async (request) => {
    const updated = await assignmentService.accept(
      {
        userId: request.actor.id,
        companyId: request.actor.companyId!,
        role: request.actor.role!,
      },
      (request.params as { id: string }).id,
    );
    return { message: 'پرونده پذیرفته شد', case: updated };
  });

  app.post('/cases/:id/reject', async (request) => {
    const body = parseWith(rejectSchema, request.body);
    return assignmentService.reject(
      {
        userId: request.actor.id,
        companyId: request.actor.companyId!,
        role: request.actor.role!,
      },
      (request.params as { id: string }).id,
      body.reason,
    );
  });
}
