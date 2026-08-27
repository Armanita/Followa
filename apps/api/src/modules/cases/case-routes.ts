import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { parseWith } from '../../lib/validation.js';
import { normalizePagination, paginated } from '../../lib/pagination.js';
import { caseService, assertCanViewCase } from './case-service.js';
import { assignmentService } from '../assignments/assignment-service.js';

import type { Actor } from './case-service.js';

const actorFrom = (request: { actor: { id: string; companyId?: string; role?: string } }): Actor => ({
  userId: request.actor.id,
  companyId: request.actor.companyId ?? '',
  role: (request.actor.role ?? 'EMPLOYEE') as Actor['role'],
});

function isClosedStatus(status: string): boolean {
  return status === 'DONE' || status === 'CANCELLED';
}

const createCaseSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(5000).optional(),
  caseTypeId: z.string().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  dueDate: z.string().datetime().optional(),
  assignToUserId: z.string().optional(),
  assignNote: z.string().max(1000).optional(),
});

const updateCaseSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  caseTypeId: z.string().nullable().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export async function caseRoutes(app: FastifyInstance): Promise<void> {
  /** Company-scoped case list with visibility filtering + status/search filters. */
  app.get('/cases', async (request) => {
    const actor = actorFrom(request);
    const query = request.query as Record<string, string | undefined>;
    const { skip, take, page, pageSize } = normalizePagination(query);

    const where = {
      companyId: actor.companyId,
      ...(actor.role === 'EMPLOYEE'
        ? {
            OR: [
              { currentOwnerId: actor.userId },
              { createdById: actor.userId },
              { assignments: { some: { toUserId: actor.userId } } },
              { assignments: { some: { fromUserId: actor.userId } } },
            ],
          }
        : {}),
      ...(query.status
        ? {
            status: query.status as
              | 'OPEN'
              | 'WAITING_ACCEPTANCE'
              | 'IN_PROGRESS'
              | 'WAITING_APPROVAL'
              | 'DONE'
              | 'CANCELLED',
          }
        : {}),
      ...(query.priority
        ? { priority: query.priority as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' }
        : {}),
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' as const } } : {}),
      ...(query.mine === 'true' ? { currentOwnerId: actor.userId } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.case.findMany({
        where,
        orderBy:
          query.sort === 'dueDate'
            ? [{ dueDate: 'asc' }, { createdAt: 'desc' }]
            : [{ createdAt: 'desc' }],
        skip,
        take,
        include: {
          currentOwner: { select: { id: true, firstName: true, lastName: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          caseType: { select: { id: true, name: true, color: true } },
        },
      }),
      prisma.case.count({ where }),
    ]);

    return paginated(
      items.map((c) => ({
        ...c,
        hasPendingAssignmentForMe: false,
      })),
      total,
      page,
      pageSize,
    );
  });

  app.post('/cases', async (request) => {
    const body = parseWith(createCaseSchema, request.body);
    const created = await caseService.createCase(actorFrom(request), {
      title: body.title,
      description: body.description,
      caseTypeId: body.caseTypeId,
      priority: body.priority,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      assignToUserId: body.assignToUserId,
      assignNote: body.assignNote,
    });
    return { message: 'پرونده ساخته شد', case: created };
  });

  app.get('/cases/:id', async (request) => {
    const actor = actorFrom(request);
    const c = await assertCanViewCase((request.params as { id: string }).id, actor);
    const [full, pendingForMe] = await Promise.all([
      prisma.case.findUniqueOrThrow({
        where: { id: c.id },
        include: {
          currentOwner: { select: { id: true, firstName: true, lastName: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          caseType: true,
          files: {
            include: { uploader: { select: { id: true, firstName: true, lastName: true } } },
            orderBy: { createdAt: 'desc' },
          },
          workSessions: {
            where: { endedAt: { not: null } },
            orderBy: { startedAt: 'desc' },
          },
          reminders: {
            orderBy: { remindAt: 'asc' },
            include: {
              assignee: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      }),
      prisma.caseAssignment.findFirst({
        where: { caseId: c.id, toUserId: actor.userId, status: 'PENDING' },
      }),
    ]);

    // Employee sees activities but assignment history is included via /assignments;
    // both are visible per spec §10 (participants can read their history).
    const isManager = actor.role === 'COMPANY_MANAGER';
    const isOwner = full.currentOwnerId === actor.userId;
    return {
      ...full,
      canEdit: isManager || isOwner,
      // Managers oversee; employees execute. Operational actions are
      // employee-only; managers get transfer/reassignment.
      canTransfer: !isClosedStatus(full.status),
      isManager,
      isCurrentOwner: isOwner,
      hasPendingAcceptanceForMe: Boolean(pendingForMe),
      totalWorkSeconds: full.workSessions.reduce(
        (sum, s) => sum + (s.durationSeconds ?? 0),
        0,
      ),
    };
  });

  app.patch('/cases/:id', async (request) => {
    const body = parseWith(updateCaseSchema, request.body);
    const updated = await caseService.updateCase(actorFrom(request), (request.params as { id: string }).id, {
      title: body.title,
      description: body.description ?? undefined,
      caseTypeId: body.caseTypeId ?? undefined,
      priority: body.priority,
      dueDate:
        body.dueDate !== undefined
          ? body.dueDate
            ? new Date(body.dueDate)
            : null
          : undefined,
    });
    return { message: 'پرونده به‌روزرسانی شد', case: updated };
  });

  app.post('/cases/:id/result', async (request) => {
    const { result, complete, effortMinutes } = parseWith(
      z.object({
        result: z.string().min(2).max(5000),
        complete: z.boolean().default(true),
        effortMinutes: z.number().int().min(1).max(1440).optional(),
      }),
      request.body,
    );
    const updated = await caseService.addResult(
      actorFrom(request),
      (request.params as { id: string }).id,
      result,
      complete,
      effortMinutes,
    );
    return { message: complete ? 'پرونده تکمیل شد' : 'نتیجه ثبت شد', case: updated };
  });

  app.post('/cases/:id/cancel', async (request) => {
    const updated = await caseService.cancelCase(actorFrom(request), (request.params as { id: string }).id);
    return { message: 'پرونده لغو شد', case: updated };
  });

  app.get('/cases/:id/activities', async (request) => {
    const actor = actorFrom(request);
    const caseId = (request.params as { id: string }).id;
    await assertCanViewCase(caseId, actor);
    return prisma.caseActivity.findMany({
      where: { caseId },
      orderBy: { createdAt: 'asc' },
      include: { actor: { select: { id: true, firstName: true, lastName: true } } },
    });
  });

  app.get('/cases/:id/assignments', async (request) => {
    const actor = actorFrom(request);
    const history = await assignmentService.history(actor, (request.params as { id: string }).id);
    return { items: history };
  });
}
