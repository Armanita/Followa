import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  /** Manager dashboard: metrics, urgent cases, recent activity, current workers. */
  app.get('/dashboard/manager', async (request) => {
    if (request.actor.role !== 'COMPANY_MANAGER') {
      return reply403();
    }
    const companyId = request.actor.companyId!;

    const statusCounts = await prisma.case.groupBy({
      by: ['status'],
      where: { companyId },
      _count: { _all: true },
    });
    const countBy = (s: string) =>
      statusCounts.find((g) => g.status === s)?._count._all ?? 0;

    const now = new Date();
    const [totalCases, lateCases, activeEmployees, urgentCases, recentActivities, activeSessions] =
      await Promise.all([
        prisma.case.count({ where: { companyId } }),
        prisma.case.count({
          where: {
            companyId,
            dueDate: { lt: now },
            status: { in: ['OPEN', 'WAITING_ACCEPTANCE', 'IN_PROGRESS', 'WAITING_APPROVAL'] },
          },
        }),
        prisma.companyMembership.count({ where: { companyId, isActive: true } }),
        prisma.case.findMany({
          where: {
            companyId,
            priority: { in: ['HIGH', 'URGENT'] },
            status: { in: ['OPEN', 'WAITING_ACCEPTANCE', 'IN_PROGRESS'] },
          },
          orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
          take: 8,
          include: {
            currentOwner: { select: { id: true, firstName: true, lastName: true } },
            caseType: { select: { name: true, color: true } },
          },
        }),
        prisma.caseActivity.findMany({
          where: { case: { companyId } },
          orderBy: { createdAt: 'desc' },
          take: 15,
          include: {
            actor: { select: { id: true, firstName: true, lastName: true } },
            case: { select: { id: true, title: true, number: true } },
          },
        }),
        prisma.workSession.findMany({
          where: { endedAt: null, case: { companyId } },
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
            case: { select: { id: true, title: true } },
          },
        }),
      ]);

    return {
      cards: {
        totalCases,
        openCases: countBy('OPEN'),
        waitingAcceptance: countBy('WAITING_ACCEPTANCE'),
        inProgress: countBy('IN_PROGRESS'),
        doneCases: countBy('DONE'),
        cancelled: countBy('CANCELLED'),
        lateCases,
        activeEmployees,
      },
      urgentCases,
      recentActivities,
      activeWorkers: activeSessions.map((s) => ({
        user: s.user,
        case: s.case,
        startedAt: s.startedAt,
      })),
      statusChart: ['OPEN', 'WAITING_ACCEPTANCE', 'IN_PROGRESS', 'DONE', 'CANCELLED'].map(
        (s) => ({ status: s, count: countBy(s) }),
      ),
    };
  });

  /** Employee dashboard. */
  app.get('/dashboard/employee', async (request) => {
    const userId = request.actor.id;
    const companyId = request.actor.companyId!;
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const visibleWhere = {
      companyId,
      OR: [
        { currentOwnerId: userId },
        { createdById: userId },
        { assignments: { some: { toUserId: userId } } },
        { assignments: { some: { fromUserId: userId } } },
      ],
    };

    const [myCases, completedByMe, todayReminders, pendingAssignments, activeSessions, recentActivities] =
      await Promise.all([
        prisma.case.count({
          where: { ...visibleWhere, status: { in: ['OPEN', 'WAITING_ACCEPTANCE', 'IN_PROGRESS'] } },
        }),
        prisma.case.count({
          where: { ...visibleWhere, status: 'DONE' },
        }),
        prisma.reminder.findMany({
          where: {
            assigneeId: userId,
            remindAt: { gte: dayStart, lt: dayEnd },
            status: 'ACTIVE',
          },
          orderBy: { remindAt: 'asc' },
          include: { case: { select: { id: true, title: true } } },
        }),
        prisma.caseAssignment.count({
          where: { toUserId: userId, status: 'PENDING' },
        }),
        prisma.workSession.findMany({
          where: { userId, endedAt: null },
          include: { case: { select: { id: true, title: true } } },
        }),
        prisma.caseActivity.findMany({
          where: {
            case: visibleWhere,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            actor: { select: { id: true, firstName: true, lastName: true } },
            case: { select: { id: true, title: true, number: true } },
          },
        }),
      ]);

    return {
      cards: {
        myCases,
        completedCases: completedByMe,
        todayReminders: todayReminders.length,
        newAssignments: pendingAssignments,
        activeWork: activeSessions.length,
      },
      remindersToday: todayReminders,
      activeWork: activeSessions.map((s) => ({
        sessionId: s.id,
        caseId: s.caseId,
        caseTitle: s.case.title,
        startedAt: s.startedAt,
      })),
      recentActivities,
    };
  });

  /** Manager reports page: per-employee stats. */
  app.get('/reports/employees', async (request) => {
    if (request.actor.role !== 'COMPANY_MANAGER') {
      return reply403();
    }
    const companyId = request.actor.companyId!;
    const memberships = await prisma.companyMembership.findMany({
      where: { companyId },
      include: { user: true },
    });

    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const report = await Promise.all(
      memberships.map(async (m) => {
        const [ownedActive, completedTotal, workSeconds30d, sessionCount30d, pendingForUser] =
          await Promise.all([
            prisma.case.count({
              where: { companyId, currentOwnerId: m.userId, status: { notIn: ['DONE', 'CANCELLED'] } },
            }),
            prisma.case.count({
              where: { companyId, currentOwnerId: m.userId, status: 'DONE' },
            }),
            prisma.workSession.aggregate({
              where: { userId: m.userId, startedAt: { gte: since } },
              _sum: { durationSeconds: true },
            }),
            prisma.workSession.count({
              where: { userId: m.userId, startedAt: { gte: since }, endedAt: { not: null } },
            }),
            prisma.caseAssignment.count({
              where: { toUserId: m.userId, status: 'PENDING' },
            }),
          ]);
        return {
          membershipId: m.id,
          user: {
            id: m.user.id,
            fullName: `${m.user.firstName} ${m.user.lastName}`,
            mobile: m.user.mobile,
          },
          role: m.role,
          isActive: m.isActive,
          ownedActiveCases: ownedActive,
          completedCases: completedTotal,
          workSeconds30d: workSeconds30d._sum.durationSeconds ?? 0,
          sessions30d: sessionCount30d,
          pendingAssignments: pendingForUser,
        };
      }),
    );
    return { items: report };
  });
}

function reply403(): never {
  const err = new Error('این بخش مخصوص مدیر شرکت است') as Error & { statusCode: number };
  err.statusCode = 403;
  throw err;
}
