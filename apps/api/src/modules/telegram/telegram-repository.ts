import type { PrismaClient } from '@prisma/client';

export type TelegramIdentityRecord = {
  telegramUserId: string;
  userId: string;
  phoneNumber?: string;
};

export type TelegramPendingConnection = {
  telegramUserId: string;
  userId: string;
  createdAt: Date;
};

export type UserLookupResult = {
  id: string;
  mobile: string;
};

const PENDING_CONNECTION_TTL_MS = 10 * 60 * 1000;

type TelegramDatabase = Pick<PrismaClient, 'user' | 'telegramIdentity' | 'telegramPendingConnection'>;

export function createTelegramRepository(db: TelegramDatabase) {
  return {
    findUserByMobile(mobile: string): Promise<UserLookupResult | null> {
      return db.user.findUnique({
        where: { mobile },
        select: { id: true, mobile: true },
      });
    },

    async createPendingConnection(input: Omit<TelegramPendingConnection, 'createdAt'>) {
      const pending = await db.telegramPendingConnection.upsert({
        where: { telegramUserId: input.telegramUserId },
        update: { userId: input.userId },
        create: input,
      });

      return {
        status: 'pending_confirmation',
        ...pending,
      };
    },

    async getPendingConnection(telegramUserId: string) {
      const pending = await db.telegramPendingConnection.findUnique({
        where: { telegramUserId },
      });

      if (!pending) {
        return null;
      }

      if (Date.now() - pending.createdAt.getTime() > PENDING_CONNECTION_TTL_MS) {
        await db.telegramPendingConnection.delete({
          where: { telegramUserId },
        });
        return null;
      }

      return pending;
    },

    async confirmTelegramIdentity(input: TelegramIdentityRecord) {
      const existing = await db.telegramIdentity.findUnique({
        where: { telegramUserId: input.telegramUserId },
        select: { userId: true },
      });

      if (existing && existing.userId !== input.userId) {
        return {
          status: 'rejected',
          reason: 'telegram_identity_already_linked',
        };
      }

      await db.telegramPendingConnection.deleteMany({
        where: { telegramUserId: input.telegramUserId },
      });

      return db.telegramIdentity.upsert({
        where: { telegramUserId: input.telegramUserId },
        update: {
          userId: input.userId,
          phoneNumber: input.phoneNumber,
        },
        create: input,
      });
    },
  };
}
