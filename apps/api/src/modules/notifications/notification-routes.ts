import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/notifications', async (request) => {
    const userId = request.actor.id;
    const query = request.query as Record<string, string | undefined>;
    const unreadOnly = query.unread === 'true';
    const take = Math.min(100, Number(query.limit ?? 50) || 50);

    const items = await prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take,
    });
    const reminderIds = items
      .filter((item) => item.linkType === 'REMINDER' && item.linkId)
      .map((item) => item.linkId!);
    const reminders = reminderIds.length > 0
      ? await prisma.reminder.findMany({
          where: { id: { in: reminderIds } },
          select: { id: true, caseId: true },
        })
      : [];
    const reminderCaseById = new Map(reminders.map((row) => [row.id, row.caseId]));
    const enriched = items.map((item) => ({
      ...item,
      caseId: item.linkType === 'CASE'
        ? item.linkId
        : item.linkType === 'REMINDER' && item.linkId
          ? reminderCaseById.get(item.linkId) ?? null
          : null,
    }));
    const unreadCount = await prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { items: enriched, unreadCount };
  });

  app.post('/notifications/:id/read', async (request) => {
    const userId = request.actor.id;
    const { id } = request.params as { id: string };
    const n = await prisma.notification.findUnique({ where: { id } });
    if (!n || n.userId !== userId) throw notFound('اعلان یافت نشد');
    if (!n.readAt) {
      await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
    }
    return { message: 'خوانده شد' };
  });

  app.post('/notifications/read-all', async (request) => {
    const userId = request.actor.id;
    await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { message: 'همه اعلان‌ها خوانده شد' };
  });
}
