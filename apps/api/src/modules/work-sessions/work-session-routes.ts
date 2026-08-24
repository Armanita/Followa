import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { parseWith } from '../../lib/validation.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { assertCanViewCase, logActivity } from '../cases/case-service.js';

interface Actor {
  userId: string;
  companyId: string;
  role: 'COMPANY_MANAGER' | 'EMPLOYEE';
}

export async function workSessionRoutes(app: FastifyInstance): Promise<void> {
  /** Start a work session on a case. Multiple parallel sessions allowed (spec §15). */
  app.post('/work-sessions/start', async (request) => {
    const actor = {
      userId: request.actor.id,
      companyId: request.actor.companyId!,
      role: request.actor.role!,
    };
    const { caseId } = parseWith(z.object({ caseId: z.string().min(1) }), request.body);
    await assertCanViewCase(caseId, actor);

    const c = await prisma.case.findUnique({ where: { id: caseId } });
    if (!c) throw notFound('پرونده یافت نشد');
    if (c.status === 'DONE' || c.status === 'CANCELLED') {
      throw conflict('روی پرونده بسته شده نمی‌توان کار کرد');
    }
    if (c.currentOwnerId !== actor.userId && actor.role !== 'COMPANY_MANAGER') {
      throw forbidden('فقط مسئول فعلی می‌تواند روی این پرونده کار کند');
    }

    // prevent duplicate open session on the SAME case by the same user
    const open = await prisma.workSession.findFirst({
      where: { caseId, userId: actor.userId, endedAt: null },
    });
    if (open) throw conflict('نشست کاری فعالی برای این پرونده دارید');

    const session = await prisma.workSession.create({
      data: { caseId, userId: actor.userId },
    });
    if (c.status === 'OPEN' || c.status === 'WAITING_ACCEPTANCE') {
      await prisma.case.update({
        where: { id: caseId },
        data: { status: 'IN_PROGRESS', currentOwnerId: actor.userId },
      });
    }
    await logActivity(caseId, 'START_WORK', actor.userId);
    return { message: 'شروع کار ثبت شد', sessionId: session.id, startedAt: session.startedAt };
  });

  /** End my open session on a case; duration is computed server-side. */
  app.post('/work-sessions/end', async (request) => {
    const userId = request.actor.id;
    const { caseId } = parseWith(z.object({ caseId: z.string().min(1) }), request.body);

    const session = await prisma.workSession.findFirst({
      where: { caseId, userId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    if (!session) throw conflict('نشست کاری فعالی برای این پرونده ندارید');

    const now = new Date();
    const durationSeconds = Math.max(
      0,
      Math.floor((now.getTime() - session.startedAt.getTime()) / 1000),
    );
    const ended = await prisma.workSession.update({
      where: { id: session.id },
      data: { endedAt: now, durationSeconds },
    });
    await logActivity(caseId, 'END_WORK', userId, { durationSeconds });
    return {
      message: 'پایان کار ثبت شد',
      durationSeconds,
      startedAt: ended.startedAt,
      endedAt: ended.endedAt,
    };
  });

  /** My active sessions across all cases. */
  app.get('/work-sessions/active', async (request) => {
    const userId = request.actor.id;
    const items = await prisma.workSession.findMany({
      where: { userId, endedAt: null },
      include: { case: { select: { id: true, title: true, status: true } } },
      orderBy: { startedAt: 'desc' },
    });
    return {
      items: items.map((s) => ({
        sessionId: s.id,
        caseId: s.caseId,
        caseTitle: s.case.title,
        caseStatus: s.case.status,
        startedAt: s.startedAt,
        elapsedSeconds: Math.floor((Date.now() - s.startedAt.getTime()) / 1000),
      })),
    };
  });

  /** Who is working right now — manager overview. */
  app.get('/work-sessions/company-active', async (request) => {
    if (request.actor.role !== 'COMPANY_MANAGER') {
      throw forbidden('این بخش مخصوص مدیر شرکت است');
    }
    const companyId = request.actor.companyId!;
    const items = await prisma.workSession.findMany({
      where: { endedAt: null, case: { companyId } },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        case: { select: { id: true, title: true } },
      },
      orderBy: { startedAt: 'desc' },
    });
    return {
      items: items.map((s) => ({
        sessionId: s.id,
        user: s.user,
        case: s.case,
        startedAt: s.startedAt,
        elapsedSeconds: Math.floor((Date.now() - s.startedAt.getTime()) / 1000),
      })),
    };
  });

  /** Work history of a case. */
  app.get('/cases/:id/work-sessions', async (request) => {
    const actor = {
      userId: request.actor.id,
      companyId: request.actor.companyId!,
      role: request.actor.role!,
    };
    const caseId = (request.params as { id: string }).id;
    await assertCanViewCase(caseId, actor);
    const sessions = await prisma.workSession.findMany({
      where: { caseId },
      orderBy: { startedAt: 'desc' },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
    return {
      items: sessions.map((s) => ({
        id: s.id,
        user: s.user,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        durationSeconds: s.durationSeconds,
      })),
    };
  });

  app.get('/work-sessions/my-summary', async (request) => {
    const userId = request.actor.id;
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const sessions = await prisma.workSession.findMany({
      where: { userId, startedAt: { gte: since }, endedAt: { not: null } },
    });
    const todaySeconds = sessions.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0);
    return { todaySeconds };
  });
}
