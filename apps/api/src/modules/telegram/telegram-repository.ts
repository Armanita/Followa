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
  expiresAt: Date;
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

    findIdentityByUserId(userId: string): Promise<TelegramIdentityRecord | null> {
      return db.telegramIdentity.findUnique({
        where: { userId },
        select: { telegramUserId: true, userId: true },
      });
    },

    findIdentityByTelegramUserId(telegramUserId: string): Promise<TelegramIdentityRecord | null> {
      return db.telegramIdentity.findUnique({
        where: { telegramUserId },
        select: { telegramUserId: true, userId: true },
      });
    },

    async createPendingConnection(input: Omit<TelegramPendingConnection, 'createdAt' | 'expiresAt'>) {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + PENDING_CONNECTION_TTL_MS);

      return db.telegramPendingConnection.upsert({
        where: { telegramUserId: input.telegramUserId },
        update: {
          userId: input.userId,
          expiresAt,
        },
        create: {
          ...input,
          createdAt: now,
          expiresAt,
        },
      });
    },

    async getPendingConnection(telegramUserId: string) {
      const pending = await db.telegramPendingConnection.findUnique({
        where: { telegramUserId },
      });

      if (!pending || pending.expiresAt < new Date()) {
        if (pending) {
          await db.telegramPendingConnection.delete({
            where: { telegramUserId },
          });
        }
        return null;
      }

      return pending;
    },

    async confirmPendingConnection(telegramUserId: string) {
      const pending = await this.getPendingConnection(telegramUserId);

      if (!pending) {
        return null;
      }

      return this.confirmTelegramIdentity({
        telegramUserId,
        userId: pending.userId,
      });
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
