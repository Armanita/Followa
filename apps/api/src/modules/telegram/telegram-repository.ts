import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { config } from '../../config.js';

export type TelegramIdentityRecord = {
  telegramUserId: string;
  userId: string;
  phoneNumber?: string;
};

export type UserLookupResult = {
  id: string;
  mobile: string;
};

type TelegramPendingConnection = {
  telegramUserId: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
};

const PENDING_CONNECTION_TTL_MS = 10 * 60 * 1000;

type TelegramDatabase = Pick<
  PrismaClient,
  'user' | 'telegramIdentity' | 'telegramPendingConnection' | '$transaction'
>;

const eligibleMembership = {
  some: {
    isActive: true,
    company: { isActive: true },
  },
};

function confirmationToken(
  pending: TelegramPendingConnection,
  mobile: string,
): string {
  return createHmac('sha256', config.telegramWebhookSecret)
    .update(
      JSON.stringify([
        'followa:telegram-link:v1',
        pending.telegramUserId,
        pending.userId,
        pending.createdAt.toISOString(),
        pending.expiresAt.toISOString(),
        mobile,
      ]),
    )
    .digest('hex')
    .slice(0, 32);
}

export function createTelegramRepository(db: TelegramDatabase) {
  // No network side effects run inside this transaction, so serialization
  // conflicts can be retried safely.
  async function serializable<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await db.$transaction(work, {
          isolationLevel: 'Serializable',
        });
      } catch (error) {
        if ((error as { code?: string }).code === 'P2034' && attempt < 2) {
          continue;
        }
        throw error;
      }
    }
  }

  return {
    findUserByMobile(mobile: string): Promise<UserLookupResult | null> {
      return db.user.findUnique({
        where: { mobile },
        select: { id: true, mobile: true },
      });
    },

    findIdentityByUserId(
      userId: string,
    ): Promise<TelegramIdentityRecord | null> {
      return db.telegramIdentity.findUnique({
        where: { userId },
        select: { telegramUserId: true, userId: true },
      });
    },

    findIdentityByTelegramUserId(
      telegramUserId: string,
    ): Promise<TelegramIdentityRecord | null> {
      return db.telegramIdentity.findUnique({
        where: { telegramUserId },
        select: { telegramUserId: true, userId: true },
      });
    },

    async createPendingConnection(input: {
      telegramUserId: string;
      userId: string;
      mobile: string;
    }) {
      if (!config.telegramWebhookSecret.trim()) {
        return null;
      }

      return serializable(async (tx) => {
        const user = await tx.user.findFirst({
          where: {
            id: input.userId,
            mobile: input.mobile,
            memberships: eligibleMembership,
          },
          select: { id: true, mobile: true },
        });

        if (!user) {
          return null;
        }

        const existing = await tx.telegramIdentity.findFirst({
          where: {
            OR: [
              { telegramUserId: input.telegramUserId },
              { userId: user.id },
            ],
          },
        });

        // Linking never replaces an existing identity, including legacy rows.
        if (existing) {
          return null;
        }

        const previous = await tx.telegramPendingConnection.findUnique({
          where: { telegramUserId: input.telegramUserId },
        });
        const now = new Date();

        // A renewed challenge must invalidate an older button even if two
        // requests happen within the same millisecond.
        const createdAt = new Date(
          Math.max(
            now.getTime(),
            (previous?.createdAt.getTime() ?? 0) + 1,
          ),
        );
        const data = {
          userId: user.id,
          createdAt,
          expiresAt: new Date(now.getTime() + PENDING_CONNECTION_TTL_MS),
        };
        const pending = await tx.telegramPendingConnection.upsert({
          where: { telegramUserId: input.telegramUserId },
          update: data,
          create: { telegramUserId: input.telegramUserId, ...data },
        });

        return { token: confirmationToken(pending, user.mobile) };
      });
    },

    async confirmPendingConnection(telegramUserId: string, token: string) {
      if (
        !config.telegramWebhookSecret.trim() ||
        !/^[a-f0-9]{32}$/.test(token)
      ) {
        return { status: 'rejected', reason: 'invalid_confirmation' };
      }

      try {
        return await serializable(async (tx) => {
          const pending = await tx.telegramPendingConnection.findUnique({
            where: { telegramUserId },
          });

          if (!pending || pending.expiresAt <= new Date()) {
            return {
              status: 'rejected',
              reason: 'pending_connection_not_found',
            };
          }

          const user = await tx.user.findFirst({
            where: {
              id: pending.userId,
              memberships: eligibleMembership,
            },
            select: { id: true, mobile: true },
          });

          if (!user) {
            return { status: 'rejected', reason: 'user_not_eligible' };
          }

          // The proof is bound to this pending generation, Telegram sender,
          // Followa user and the user's current mobile.
          const expected = confirmationToken(pending, user.mobile);
          if (
            !timingSafeEqual(
              Buffer.from(token, 'hex'),
              Buffer.from(expected, 'hex'),
            )
          ) {
            return { status: 'rejected', reason: 'invalid_confirmation' };
          }

          const existing = await tx.telegramIdentity.findFirst({
            where: {
              OR: [{ telegramUserId }, { userId: pending.userId }],
            },
          });
          if (existing) {
            return {
              status: 'rejected',
              reason: 'identity_already_linked',
            };
          }

          const consumed = await tx.telegramPendingConnection.deleteMany({
            where: {
              telegramUserId,
              userId: pending.userId,
              createdAt: pending.createdAt,
              expiresAt: {
                equals: pending.expiresAt,
                gt: new Date(),
              },
            },
          });
          if (consumed.count !== 1) {
            return {
              status: 'rejected',
              reason: 'pending_connection_not_found',
            };
          }

          await tx.telegramIdentity.create({
            data: {
              telegramUserId,
              userId: user.id,
              phoneNumber: user.mobile,
            },
          });

          return { status: 'connected' };
        });
      } catch (error) {
        // A uniqueness race rolls back the whole transaction, including the
        // conditional pending deletion.
        if ((error as { code?: string }).code === 'P2002') {
          return {
            status: 'rejected',
            reason: 'identity_already_linked',
          };
        }
        throw error;
      }
    },
  };
}
