import type { PrismaClient } from '@prisma/client';
import { config } from '../../config.js';
import { prisma } from '../../lib/prisma.js';
import { notificationService } from '../notifications/notification-service.js';
import { claimReminderForNotification, releaseReminderClaim } from './reminder-claim.js';

const safeError = (error: unknown) =>
  (error instanceof Error ? `${error.name}: ${error.message}` : 'worker_error').slice(0, 500);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let lastHeartbeatAt: Date | null = null;

export function getReminderWorkerHeartbeat(): Date | null {
  return lastHeartbeatAt;
}

export function createReminderDueWorker(
  client: PrismaClient = prisma,
  options = {
    pollMs: config.reminderDueWorkerPollMs,
    batchSize: config.reminderDueWorkerBatchSize,
    maxAgeMs: config.reminderDueMaxAgeHours * 3600_000,
  },
) {
  return {
    async runOnce(): Promise<{ expired: number; notified: number }> {
      const now = new Date();
      const maxAgeCutoff = new Date(now.getTime() - options.maxAgeMs);

      // Backfill/safety: never notify historical overdue beyond max age.
      const expiredOverdue = await client.reminder.updateMany({
        where: { status: 'ACTIVE', remindAt: { lt: maxAgeCutoff } },
        data: { status: 'EXPIRED' },
      });

      // Reminders on closed cases must not fire notifications.
      const expiredClosed = await client.reminder.updateMany({
        where: {
          status: 'ACTIVE',
          case: { status: { in: ['DONE', 'CANCELLED'] } },
        },
        data: { status: 'EXPIRED' },
      });

      const due = await client.reminder.findMany({
        where: {
          status: 'ACTIVE',
          notifiedAt: null,
          remindAt: { lte: now, gte: maxAgeCutoff },
          case: { status: { notIn: ['DONE', 'CANCELLED'] } },
        },
        orderBy: { remindAt: 'asc' },
        take: options.batchSize,
        select: { id: true, assigneeId: true },
      });

      let notified = 0;
      for (const reminder of due) {
        const claimed = await claimReminderForNotification(client, reminder.id);
        if (!claimed) continue;
        try {
          await notificationService.notifyEvent({
            userId: reminder.assigneeId,
            event: { kind: 'REMINDER_DUE', reminderId: reminder.id },
          });
          notified += 1;
        } catch (error) {
          await releaseReminderClaim(client, reminder.id);
          throw error;
        }
      }

      return { expired: expiredOverdue.count + expiredClosed.count, notified };
    },
  };
}

export async function runReminderDueWorker(): Promise<void> {
  const worker = createReminderDueWorker();
  let stopping = false;
  const onShutdown = (signal: string) => {
    if (!stopping) console.log('[reminder-due-worker] stopping (' + signal + ')');
    stopping = true;
  };
  process.once('SIGTERM', () => onShutdown('SIGTERM'));
  process.once('SIGINT', () => onShutdown('SIGINT'));
  console.log('[reminder-due-worker] started');
  while (!stopping) {
    try {
      await worker.runOnce();
      lastHeartbeatAt = new Date();
      await delay(config.reminderDueWorkerPollMs);
    } catch (error) {
      console.error('[reminder-due-worker] iteration failed', safeError(error));
      await delay(config.reminderDueWorkerPollMs);
    }
  }
  console.log('[reminder-due-worker] stopping');
}

const isDirectRun = /reminder-due-worker\.(js|ts)$/.test(process.argv[1] ?? '');
if (isDirectRun) {
  runReminderDueWorker()
    .then(() => prisma.$disconnect())
    .catch(async (error) => {
      console.error('[reminder-due-worker] fatal', safeError(error));
      await prisma.$disconnect();
      process.exit(1);
    });
}
