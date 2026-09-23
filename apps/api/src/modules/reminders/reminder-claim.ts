import type { Prisma, PrismaClient } from '@prisma/client';

type ClaimClient = PrismaClient | Prisma.TransactionClient;

/**
 * Atomically claims a reminder for REMINDER_DUE notification creation.
 * Only one caller can flip notifiedAt from NULL, so worker and due-check
 * can both run safely without duplicate notifications.
 */
export async function claimReminderForNotification(
  client: ClaimClient,
  reminderId: string,
): Promise<boolean> {
  const claimed = await client.reminder.updateMany({
    where: { id: reminderId, status: 'ACTIVE', notifiedAt: null },
    data: { notifiedAt: new Date() },
  });
  return claimed.count === 1;
}

/** Releases a claim after a failed notification so a later run can retry. */
export async function releaseReminderClaim(
  client: ClaimClient,
  reminderId: string,
): Promise<void> {
  await client.reminder.updateMany({
    where: { id: reminderId },
    data: { notifiedAt: null },
  });
}
