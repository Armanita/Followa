import { Prisma, type PrismaClient } from '@prisma/client';

export type NotificationContextInput = {
  companyId?: string;
  linkType?: string;
  linkId?: string;
};

type Database = PrismaClient | Prisma.TransactionClient;

async function companyFromLink(db: Database, linkType?: string, linkId?: string): Promise<string | null> {
  if (!linkType || !linkId) return null;
  if (linkType === 'CASE') {
    return (await db.case.findUnique({ where: { id: linkId }, select: { companyId: true } }))?.companyId ?? null;
  }
  if (linkType === 'REMINDER') {
    return (await db.reminder.findUnique({
      where: { id: linkId },
      select: { case: { select: { companyId: true } } },
    }))?.case.companyId ?? null;
  }
  return null;
}

/** Never guesses company context: an explicit value must agree with the linked entity. */
export async function resolveNotificationCompany(
  db: Database,
  input: NotificationContextInput,
): Promise<string | null> {
  const linkedCompanyId = await companyFromLink(db, input.linkType, input.linkId);
  if (input.companyId && linkedCompanyId && input.companyId !== linkedCompanyId) return null;
  return input.companyId ?? linkedCompanyId;
}

export async function findActiveRecipientMembership(db: Database, userId: string, companyId: string) {
  return db.companyMembership.findUnique({
    where: { userId_companyId: { userId, companyId } },
    select: {
      id: true,
      isActive: true,
      company: { select: { isActive: true } },
    },
  });
}
