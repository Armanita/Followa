import { prisma } from '../../lib/prisma.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { notificationService } from '../notifications/notification-service.js';

export interface Actor {
  userId: string;
  companyId: string;
  role: 'COMPANY_MANAGER' | 'EMPLOYEE';
}

export async function assertCanViewCase(caseId: string, actor: Actor) {
  const c = await prisma.case.findUnique({
    where: { id: caseId },
    include: { assignments: { select: { fromUserId: true, toUserId: true } } },
  });
  if (!c || c.companyId !== actor.companyId) throw notFound('پرونده یافت نشد');
  if (actor.role === 'COMPANY_MANAGER') return c;

  const involved =
    c.currentOwnerId === actor.userId ||
    c.createdById === actor.userId ||
    c.assignments.some((a) => a.fromUserId === actor.userId || a.toUserId === actor.userId);
  if (!involved) throw forbidden('به این پرونده دسترسی ندارید');
  return c;
}

export async function assertCanEditCase(caseId: string, actor: Actor) {
  const c = await assertCanViewCase(caseId, actor);
  if (actor.role === 'COMPANY_MANAGER') return c;
  if (c.currentOwnerId !== actor.userId) {
    throw forbidden('فقط مسئول فعلی پرونده می‌تواند آن را ویرایش کند');
  }
  return c;
}

export async function logActivity(
  caseId: string,
  type:
    | 'CREATE'
    | 'ASSIGN'
    | 'ACCEPT'
    | 'REJECT'
    | 'START_WORK'
    | 'END_WORK'
    | 'RESULT_ADDED'
    | 'FILE_UPLOADED'
    | 'COMPLETE'
    | 'CANCEL'
    | 'REMINDER_CREATED'
    | 'REMINDER_DONE',
  actorId: string | null,
  payload?: Record<string, unknown>,
): Promise<void> {
  await prisma.caseActivity.create({
    data: { caseId, type, actorId, payload: (payload ?? undefined) as never },
  });
}

export const caseService = {
  async createCase(
    actor: Actor,
    input: {
      title: string;
      description?: string;
      caseTypeId?: string;
      customerId?: string;
      priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
      dueDate?: Date;
      assignToUserId?: string;
      assignNote?: string;
    },
  ) {
    if (input.caseTypeId) {
      const type = await prisma.caseType.findUnique({ where: { id: input.caseTypeId } });
      if (!type || type.companyId !== actor.companyId)
        throw badRequest('نوع پرونده معتبر نیست');
    }

    if (input.customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: input.customerId, companyId: actor.companyId, isActive: true },
        select: { id: true },
      });
      if (!customer) throw badRequest('مشتری فعال معتبر نیست');
    }

    let assigneeId: string | null = null;
    if (input.assignToUserId) {
      if (input.assignToUserId === actor.userId && actor.role === 'COMPANY_MANAGER') {
        throw badRequest('ارجاع پرونده به خودتان مجاز نیست. برای کارکنان ارجاع دهید.');
      }
      const membership = await prisma.companyMembership.findFirst({
        where: { userId: input.assignToUserId, companyId: actor.companyId, isActive: true },
      });
      if (!membership) throw badRequest('کاربر مقصد در شرکت فعال نیست');
      if (actor.role === 'COMPANY_MANAGER' && membership.role === 'COMPANY_MANAGER') {
        throw badRequest('مدیر نمی‌تواند پرونده را به مدیر دیگر ارجاع دهد');
      }
      assigneeId = input.assignToUserId;
    }

    const created = await prisma.$transaction(async (tx) => {
      const c = await tx.case.create({
        data: {
          companyId: actor.companyId,
          customerId: input.customerId,
          title: input.title,
          description: input.description,
          caseTypeId: input.caseTypeId,
          priority: input.priority ?? 'NORMAL',
          dueDate: input.dueDate,
          status: assigneeId ? 'WAITING_ACCEPTANCE' : 'OPEN',
          currentOwnerId: assigneeId ?? actor.userId,
          createdById: actor.userId,
        },
      });
      await tx.caseActivity.create({
        data: { caseId: c.id, type: 'CREATE', actorId: actor.userId },
      });
      if (assigneeId) {
        await tx.caseAssignment.create({
          data: {
            caseId: c.id,
            fromUserId: actor.userId,
            toUserId: assigneeId,
            reason: 'INITIAL_ASSIGNMENT',
            note: input.assignNote,
          },
        });
        await tx.caseActivity.create({
          data: {
            caseId: c.id,
            type: 'ASSIGN',
            actorId: actor.userId,
            payload: { toUserId: assigneeId },
          },
        });
      }
      return c;
    });

    if (assigneeId && assigneeId !== actor.userId) {
      await notificationService.notify({
        userId: assigneeId,
        type: 'CASE_ASSIGNED',
        title: 'پرونده جدید به شما ارجاع شد',
        body: input.title,
        linkType: 'CASE',
        linkId: created.id,
      });
    }
    return created;
  },

  async updateCase(
    actor: Actor,
    caseId: string,
    input: {
      title?: string;
      description?: string | null;
      caseTypeId?: string | null;
      priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
      dueDate?: Date | null;
    },
  ) {
    await assertCanEditCase(caseId, actor);
    if (input.caseTypeId) {
      const type = await prisma.caseType.findUnique({ where: { id: input.caseTypeId } });
      if (!type || type.companyId !== actor.companyId)
        throw badRequest('نوع پرونده معتبر نیست');
    }
    return prisma.case.update({
      where: { id: caseId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.caseTypeId !== undefined ? { caseTypeId: input.caseTypeId } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
      },
    });
  },

  async addResult(
    actor: Actor,
    caseId: string,
    result: string,
    complete: boolean,
    effortMinutes?: number,
    nextReminder?: { remindAt: Date; note?: string },
  ) {
    const c = await assertCanEditCase(caseId, actor);
    if (c.status === 'DONE') throw conflict('پرونده قبلاً تکمیل شده است');
    if (complete && nextReminder) throw badRequest('برای پرونده تکمیل‌شده یادآوری بعدی ثبت نمی‌شود');
    if (nextReminder && nextReminder.remindAt.getTime() < Date.now() - 60 * 1000) {
      throw badRequest('زمان یادآوری نمی‌تواند در گذشته باشد');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const nextCase = await tx.case.update({
        where: { id: caseId },
        data: {
          result,
          resultAt: new Date(),
          ...(complete
            ? { status: 'DONE' as const }
            : c.status === 'OPEN'
              ? { status: 'IN_PROGRESS' as const }
              : {}),
        },
      });

      await tx.caseActivity.create({
        data: {
          caseId,
          type: 'RESULT_ADDED',
          actorId: actor.userId,
          payload: { result, ...(effortMinutes !== undefined ? { effortMinutes } : {}) },
        },
      });

      const activeReminders = await tx.reminder.findMany({
        where: { caseId, assigneeId: actor.userId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (activeReminders.length > 0) {
        const completedAt = new Date();
        await tx.reminder.updateMany({
          where: { id: { in: activeReminders.map((reminder) => reminder.id) } },
          data: { status: 'DONE', completedAt },
        });
        for (const reminder of activeReminders) {
          await tx.caseActivity.create({
            data: {
              caseId,
              type: 'REMINDER_DONE',
              actorId: actor.userId,
              payload: { reminderId: reminder.id },
            },
          });
        }
      }

      if (nextReminder) {
        const reminder = await tx.reminder.create({
          data: {
            caseId,
            assigneeId: actor.userId,
            creatorId: actor.userId,
            remindAt: nextReminder.remindAt,
            note: nextReminder.note,
          },
        });
        await tx.caseActivity.create({
          data: {
            caseId,
            type: 'REMINDER_CREATED',
            actorId: actor.userId,
            payload: {
              reminderId: reminder.id,
              remindAt: nextReminder.remindAt.toISOString(),
              note: nextReminder.note,
            },
          },
        });
      }

      if (complete) {
        await tx.caseActivity.create({
          data: { caseId, type: 'COMPLETE', actorId: actor.userId },
        });
      }
      return nextCase;
    });

    if (complete && c.createdById !== actor.userId) {
      await notificationService.notify({
        userId: c.createdById,
        type: 'CASE_COMPLETED',
        title: 'پرونده تکمیل شد',
        body: c.title,
        linkType: 'CASE',
        linkId: caseId,
      });
    }
    return updated;
  },

  async cancelCase(actor: Actor, caseId: string) {
    const c = await assertCanViewCase(caseId, actor);
    if (actor.role !== 'COMPANY_MANAGER' && c.createdById !== actor.userId) {
      throw forbidden('فقط مدیر یا سازنده پرونده می‌تواند آن را لغو کند');
    }
    if (c.status === 'DONE') throw conflict('پرونده تکمیل‌شده قابل لغو نیست');
    await prisma.case.update({ where: { id: caseId }, data: { status: 'CANCELLED' } });
    await logActivity(caseId, 'CANCEL', actor.userId);
    return prisma.case.findUniqueOrThrow({ where: { id: caseId } });
  },
};
