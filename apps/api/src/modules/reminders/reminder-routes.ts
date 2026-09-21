import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { parseWith } from '../../lib/validation.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { assertCanViewCase, logActivity } from '../cases/case-service.js';
import { notificationService } from '../notifications/notification-service.js';

const createReminderSchema = z.object({
  caseId: z.string().min(1),
  remindAt: z.string().datetime(),
  note: z.string().max(1000).optional(),
});

/** Marks due ACTIVE reminders as EXPIRED lazily (no scheduler needed for MVP). */
async function expireOverdue() {
  await prisma.reminder.updateMany({
    where: { status: 'ACTIVE', remindAt: { lt: new Date(Date.now() - 24 * 3600 * 1000) } },
    data: { status: 'EXPIRED' },
  });
}

export async function reminderRoutes(app: FastifyInstance): Promise<void> {
  app.post('/reminders', async (request) => {
    const userId = request.actor.id;
    const body = parseWith(createReminderSchema, request.body);
    await assertCanViewCase(body.caseId, {
      userId,
      companyId: request.actor.companyId!,
      role: request.actor.role!,
    });
    const c = await prisma.case.findUnique({ where: { id: body.caseId } });
    if (!c) throw notFound('پرونده یافت نشد');
    if (c.status === 'DONE' || c.status === 'CANCELLED') {
      throw conflict('برای پرونده بسته‌شده یادآوری جدید ثبت نمی‌شود');
    }
    const remindAt = new Date(body.remindAt);
    if (remindAt.getTime() < Date.now() - 60 * 1000) {
      throw badRequest('زمان یادآوری نمی‌تواند در گذشته باشد');
    }

    const activeReminder = await prisma.reminder.findFirst({
      where: { caseId: body.caseId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (activeReminder) {
      throw conflict('برای این پرونده یک یادآوری فعال وجود دارد');
    }

    const reminder = await prisma.reminder.create({
      data: {
        caseId: body.caseId,
        assigneeId: userId, // reminder always belongs to its creator's queue
        creatorId: userId,
        remindAt,
        note: body.note,
      },
    });
    await logActivity(body.caseId, 'REMINDER_CREATED', userId, {
      reminderId: reminder.id,
      remindAt: remindAt.toISOString(),
      note: body.note,
    });
    return { message: 'یادآوری ساخته شد', reminder };
  });

  /** My reminders with optional status filter; "today" via query. */
  app.get('/reminders', async (request) => {
    await expireOverdue();
    const userId = request.actor.id;
    const query = request.query as Record<string, string | undefined>;

    let remindAtFilter;
    if (query.today === 'true') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      remindAtFilter = { gte: start, lt: end };
    } else if (query.upcoming === 'true') {
      remindAtFilter = { gte: new Date() };
    }

    const items = await prisma.reminder.findMany({
      where: {
        assigneeId: userId,
        ...(query.status
          ? { status: query.status as 'ACTIVE' | 'DONE' | 'EXPIRED' }
          : {}),
        ...(remindAtFilter ? { remindAt: remindAtFilter } : {}),
      },
      orderBy: { remindAt: 'asc' },
      include: {
        case: { select: { id: true, title: true, number: true, status: true } },
      },
    });
    return { items };
  });

  /**
   * Complete a reminder. The primary employee flow records results from the
   * case result form; this endpoint remains for reminder-list compatibility.
   * It must never reopen a DONE/CANCELLED case.
   */
  app.post('/reminders/:id/complete', async (request) => {
    const userId = request.actor.id;
    const { id } = request.params as { id: string };
    const body = parseWith(
      z.object({ result: z.string().max(5000).optional() }),
      request.body ?? {},
    );

    const reminder = await prisma.reminder.findUnique({ where: { id } });
    if (!reminder) throw notFound('یادآوری یافت نشد');
    if (reminder.assigneeId !== userId) throw forbidden('این یادآوری متعلق به شما نیست');
    if (reminder.status !== 'ACTIVE') throw conflict('این یادآوری قبلاً بسته شده است');

    const c = await prisma.case.findUnique({ where: { id: reminder.caseId } });
    if (!c) throw notFound('پرونده یافت نشد');
    const caseIsClosed = c.status === 'DONE' || c.status === 'CANCELLED';

    await prisma.$transaction([
      prisma.reminder.update({
        where: { id },
        data: { status: 'DONE', completedAt: new Date() },
      }),
      ...(body.result && !caseIsClosed
        ? [
            prisma.case.update({
              where: { id: reminder.caseId },
              data: {
                result: body.result,
                resultAt: new Date(),
                ...(c.status === 'OPEN' ? { status: 'IN_PROGRESS' as const } : {}),
              },
            }),
          ]
        : []),
      prisma.caseActivity.create({
        data: {
          caseId: reminder.caseId,
          type: 'REMINDER_DONE',
          actorId: userId,
          payload: { reminderId: id, result: body.result },
        },
      }),
    ]);
    return { message: 'یادآوری انجام شد' };
  });

  // Reminder-due notifications are generated on dashboard fetch (MVP approach):
  // This lazy mechanism will be replaced by the approved persistent worker in
  // the Bale/notification reliability phase.
  app.get('/reminders/due-check', async (request) => {
    const userId = request.actor.id;
    const now = new Date();
    const due = await prisma.reminder.findMany({
      where: { assigneeId: userId, status: 'ACTIVE', remindAt: { lte: now } },
      include: { case: { select: { title: true } } },
    });
    for (const r of due) {
      const already = await prisma.notification.findFirst({
        where: {
          userId,
          type: 'REMINDER_DUE',
          linkId: r.id,
        },
      });
      if (!already) {
        await notificationService.notifyEvent({
          userId,
          event: { kind: 'REMINDER_DUE', reminderId: r.id },
        });
      }
    }
    return { dueCount: due.length };
  });
}
