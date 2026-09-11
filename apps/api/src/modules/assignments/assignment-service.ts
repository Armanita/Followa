import { prisma } from '../../lib/prisma.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { assertCanViewCase, type Actor } from '../cases/case-service.js';
import { notificationService } from '../notifications/notification-service.js';

async function notifyHistoricalSenderIfStillActive(
  companyId: string,
  actor: Actor,
  senderUserId: string | null,
  input: {
    type: 'CASE_ACCEPTED' | 'CASE_REJECTED';
    title: string;
    body: string;
    caseId: string;
  },
): Promise<void> {
  if (!senderUserId || senderUserId === actor.userId) return;

  const membership = await prisma.companyMembership.findFirst({
    where: {
      companyId,
      userId: senderUserId,
      isActive: true,
    },
    select: { role: true },
  });
  if (!membership) return;

  // When an employee responds to a current manager, the manager broadcast below
  // already covers that recipient. Preserve direct feedback for active employees
  // (and for manager-originated flows) without duplicating manager notifications.
  if (actor.role === 'EMPLOYEE' && membership.role === 'COMPANY_MANAGER') return;

  await notificationService.notify({
    userId: senderUserId,
    type: input.type,
    title: input.title,
    body: input.body,
    linkType: 'CASE',
    linkId: input.caseId,
  });
}

export const assignmentService = {
  /**
   * Transfer the case to another active employee in the same company. Only the
   * current owner (or a manager) can transfer. Case moves to WAITING_ACCEPTANCE;
   * the previous owner loses ownership immediately.
   */
  async transfer(actor: Actor, caseId: string, toUserId: string, note?: string) {
    if (toUserId === actor.userId) throw badRequest('انتقال پرونده به خودتان مجاز نیست');

    const c = await prisma.case.findUnique({ where: { id: caseId } });
    if (!c || c.companyId !== actor.companyId) throw notFound('پرونده یافت نشد');
    if (actor.role !== 'COMPANY_MANAGER' && c.currentOwnerId !== actor.userId) {
      throw forbidden('فقط مسئول فعلی یا مدیر می‌تواند پرونده را منتقل کند');
    }
    if (c.status === 'DONE' || c.status === 'CANCELLED') {
      throw conflict('پرونده بسته شده است و قابل انتقال نیست');
    }

    const targetMembership = await prisma.companyMembership.findFirst({
      where: {
        userId: toUserId,
        companyId: actor.companyId,
        isActive: true,
        role: 'EMPLOYEE',
      },
      include: { user: true },
    });
    if (!targetMembership) throw badRequest('کارمند مقصد در این شرکت فعال نیست');

    const result = await prisma.$transaction(async (tx) => {
      const assignment = await tx.caseAssignment.create({
        data: {
          caseId,
          fromUserId: actor.userId,
          toUserId,
          reason: 'TRANSFER',
          note,
        },
      });
      await tx.case.update({
        where: { id: caseId },
        data: {
          status: 'WAITING_ACCEPTANCE',
          currentOwnerId: null,
        },
      });
      await tx.caseActivity.create({
        data: {
          caseId,
          type: 'ASSIGN',
          actorId: actor.userId,
          payload: { toUserId, assignmentId: assignment.id },
        },
      });
      return assignment;
    });

    await notificationService.notify({
      userId: toUserId,
      type: 'CASE_ASSIGNED',
      title: 'پرونده‌ای به شما ارجاع شد',
      body: c.title,
      linkType: 'CASE',
      linkId: caseId,
    });

    if (actor.role === 'EMPLOYEE') {
      await notificationService.notifyActiveCompanyManagers({
        companyId: actor.companyId,
        excludeUserId: actor.userId,
        type: 'CASE_UPDATED',
        title: 'پرونده منتقل شد',
        body: c.title,
        linkType: 'CASE',
        linkId: caseId,
      });
    }
    return result;
  },

  async accept(actor: Actor, caseId: string) {
    const pending = await prisma.caseAssignment.findFirst({
      where: { caseId, toUserId: actor.userId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    if (!pending) throw conflict('ارجاع در انتظار پاسخی برای شما وجود ندارد');

    const c = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    if (c.status !== 'WAITING_ACCEPTANCE') {
      throw conflict('این پرونده در وضعیت انتظار پذیرش نیست');
    }

    const [, updated] = await prisma.$transaction([
      prisma.caseAssignment.update({
        where: { id: pending.id },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      }),
      prisma.case.update({
        where: { id: caseId },
        data: { status: 'IN_PROGRESS', currentOwnerId: actor.userId },
      }),
      prisma.caseActivity.create({
        data: { caseId, type: 'ACCEPT', actorId: actor.userId },
      }),
    ]);

    await notifyHistoricalSenderIfStillActive(c.companyId, actor, pending.fromUserId, {
      type: 'CASE_ACCEPTED',
      title: 'ارجاع پرونده پذیرفته شد',
      body: c.title,
      caseId,
    });

    if (actor.role === 'EMPLOYEE') {
      await notificationService.notifyActiveCompanyManagers({
        companyId: c.companyId,
        excludeUserId: actor.userId,
        type: 'CASE_ACCEPTED',
        title: 'ارجاع پرونده پذیرفته شد',
        body: c.title,
        linkType: 'CASE',
        linkId: caseId,
      });
    }
    return updated;
  },

  async reject(actor: Actor, caseId: string, rejectReason: string) {
    const pending = await prisma.caseAssignment.findFirst({
      where: { caseId, toUserId: actor.userId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    if (!pending) throw conflict('ارجاع در انتظار پاسخی برای شما وجود ندارد');

    const c = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    if (c.status !== 'WAITING_ACCEPTANCE') {
      throw conflict('این پرونده در وضعیت انتظار پذیرش نیست');
    }
    const senderUserId = pending.fromUserId;
    if (!senderUserId) {
      throw conflict('این ارجاع فرستنده ندارد و قابل رد شدن نیست');
    }

    const returnedToActiveSender = await prisma.$transaction(async (tx) => {
      const activeSenderMembership = await tx.companyMembership.findFirst({
        where: {
          companyId: c.companyId,
          userId: senderUserId,
          isActive: true,
        },
        select: { id: true },
      });
      const canReturnToSender = Boolean(activeSenderMembership);

      await tx.caseAssignment.update({
        where: { id: pending.id },
        data: { status: 'REJECTED', rejectReason, respondedAt: new Date() },
      });

      if (canReturnToSender) {
        await tx.caseAssignment.create({
          data: {
            caseId,
            fromUserId: actor.userId,
            toUserId: senderUserId,
            reason: 'RETURN_AFTER_REJECT',
            note: `رد شد: ${rejectReason}`,
            status: 'ACCEPTED',
            respondedAt: new Date(),
          },
        });
      }

      await tx.case.update({
        where: { id: caseId },
        data: canReturnToSender
          ? {
              status: 'IN_PROGRESS',
              currentOwnerId: senderUserId,
            }
          : {
              status: 'OPEN',
              currentOwnerId: null,
            },
      });

      await tx.caseActivity.create({
        data: {
          caseId,
          type: 'REJECT',
          actorId: actor.userId,
          payload: canReturnToSender
            ? { rejectReason, returnedTo: senderUserId }
            : {
                rejectReason,
                returnedTo: null,
                fallback: 'OPEN_FOR_ACTIVE_MANAGERS',
              },
        },
      });

      return canReturnToSender;
    });

    const body = `${c.title} — دلیل: ${rejectReason}`;
    await notifyHistoricalSenderIfStillActive(c.companyId, actor, senderUserId, {
      type: 'CASE_REJECTED',
      title: 'ارجاع پرونده رد شد',
      body,
      caseId,
    });

    if (actor.role === 'EMPLOYEE') {
      await notificationService.notifyActiveCompanyManagers({
        companyId: c.companyId,
        excludeUserId: actor.userId,
        type: 'CASE_REJECTED',
        title: 'ارجاع پرونده رد شد',
        body,
        linkType: 'CASE',
        linkId: caseId,
      });
    }
    return {
      message: returnedToActiveSender
        ? 'پرونده رد شد و به ارجاع‌دهنده بازگشت'
        : 'پرونده رد شد و برای پیگیری مدیران فعال شرکت باز شد',
    };
  },

  async history(actor: Actor, caseId: string) {
    await assertCanViewCase(caseId, actor);
    return prisma.caseAssignment.findMany({
      where: { caseId },
      orderBy: { createdAt: 'asc' },
      include: {
        fromUs: { select: { id: true, firstName: true, lastName: true } },
        toUs: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  },
};
