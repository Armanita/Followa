import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  MessagingChannel,
  MessagingIdentityStatus,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';
import { config } from '../../config.js';
import {
  findOperationalTelegramIdentityByExternalId,
  findOperationalTelegramIdentityByUserId,
} from '../messaging/messaging-repository.js';

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
const SECURE_VERIFICATION_METHOD = 'TELEGRAM_SIGNED_CALLBACK_V1';

type TelegramDatabase = Pick<
  PrismaClient,
  | 'user'
  | 'telegramIdentity'
  | 'telegramPendingConnection'
  | 'messagingIdentity'
  | '$transaction'
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

    async findIdentityByUserId(
      userId: string,
    ): Promise<TelegramIdentityRecord | null> {
      return findOperationalTelegramIdentityByUserId(
        db,
        userId,
        config.messagingIdentityReadEnabled,
      );
    },

    async findIdentityByTelegramUserId(
      telegramUserId: string,
    ): Promise<TelegramIdentityRecord | null> {
      return findOperationalTelegramIdentityByExternalId(
        db,
        telegramUserId,
        config.messagingIdentityReadEnabled,
      );
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
        // Kept for backward compatibility until TelegramIdentity table is dropped.
        if (existing) {
          return null;
        }

        // MessagingIdentity is now the primary source of truth for Telegram linking.
        // This check is unconditional - no longer gated by MESSAGING_IDENTITY_DUAL_WRITE_ENABLED.
        const [byUser, byExternal] = await Promise.all([
          tx.messagingIdentity.findUnique({
            where: {
              userId_channel: {
                userId: user.id,
                channel: MessagingChannel.TELEGRAM,
              },
            },
          }),
          tx.messagingIdentity.findUnique({
            where: {
              channel_externalUserId: {
                channel: MessagingChannel.TELEGRAM,
                externalUserId: input.telegramUserId,
              },
            },
          }),
        ]);
        const sameIdentity =
          byUser &&
          byExternal &&
          byUser.id === byExternal.id &&
          byUser.userId === user.id &&
          byUser.externalUserId === input.telegramUserId;

        if ((byUser || byExternal) && !sameIdentity) {
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
          // Kept for backward compatibility - primary check is now MessagingIdentity.
          if (existing) {
            return {
              status: 'rejected',
              reason: 'identity_already_linked',
            };
          }

          // MessagingIdentity is the primary source of truth - unconditional check.
          const [byUser, byExternal] = await Promise.all([
            tx.messagingIdentity.findUnique({
              where: {
                userId_channel: {
                  userId: user.id,
                  channel: MessagingChannel.TELEGRAM,
                },
              },
            }),
            tx.messagingIdentity.findUnique({
              where: {
                channel_externalUserId: {
                  channel: MessagingChannel.TELEGRAM,
                  externalUserId: telegramUserId,
                },
              },
            }),
          ]);
          const sameIdentity =
            byUser &&
            byExternal &&
            byUser.id === byExternal.id &&
            byUser.userId === user.id &&
            byUser.externalUserId === telegramUserId;

          if ((byUser || byExternal) && !sameIdentity) {
            return {
              status: 'rejected',
              reason: 'messaging_identity_conflict',
            };
          }
          const genericIdentity: { id: string } | null = sameIdentity ? { id: byUser.id } : null;

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

          // TelegramIdentity kept for backward compatibility until table is dropped.
          await tx.telegramIdentity.create({
            data: {
              telegramUserId,
              userId: user.id,
              phoneNumber: user.mobile,
            },
          });

          // MessagingIdentity is now the primary storage - unconditional write.
          {
            const verifiedAt = new Date();
            if (genericIdentity) {
              await tx.messagingIdentity.update({
                where: { id: genericIdentity.id },
                data: {
                  destinationId: telegramUserId,
                  status: MessagingIdentityStatus.ACTIVE,
                  verifiedAt,
                  verificationMethod: SECURE_VERIFICATION_METHOD,
                  legacySource: null,
                  revokedAt: null,
                  version: { increment: 1 },
                },
              });
            } else {
              await tx.messagingIdentity.create({
                data: {
                  userId: user.id,
                  channel: MessagingChannel.TELEGRAM,
                  externalUserId: telegramUserId,
                  destinationId: telegramUserId,
                  status: MessagingIdentityStatus.ACTIVE,
                  verifiedAt,
                  verificationMethod: SECURE_VERIFICATION_METHOD,
                },
              });
            }
          }

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
