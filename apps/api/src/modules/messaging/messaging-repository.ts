import {
  MessagingChannel,
  type MessagingIdentityStatus,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';

export type CreateMessagingIdentityInput = {
  userId: string;
  channel: MessagingChannel;
  externalUserId: string;
  destinationId?: string;
  status?: MessagingIdentityStatus;
  verifiedAt?: Date;
  verificationMethod?: string;
  legacySource?: string;
};

export type CreateMessagingLinkChallengeInput = {
  userId: string;
  channel: MessagingChannel;
  externalUserId: string;
  destinationId?: string;
  /** A one-way digest only. Raw challenge tokens must never reach this layer. */
  tokenHash: string;
  expiresAt: Date;
};

export type LegacyTelegramIdentityInput = {
  legacyIdentityId: string;
  userId: string;
  telegramUserId: string;
};

export type LegacyTelegramImportResult =
  | { status: 'would_create' | 'created' | 'already_synced' }
  | {
      status: 'conflict';
      reason:
        | 'user_channel_taken'
        | 'external_identity_taken'
        | 'inconsistent_identity';
    };

type MessagingDatabase = Pick<
  PrismaClient,
  'messagingIdentity' | 'messagingLinkChallenge' | '$transaction'
>;

type IdentityReader = Pick<
  Prisma.TransactionClient,
  'messagingIdentity'
>;

const LEGACY_SOURCE = 'telegram_identities';
const LEGACY_VERIFICATION_METHOD = 'LEGACY_IMPORT_UNVERIFIED';

async function inspectLegacyTelegramIdentity(
  db: IdentityReader,
  input: LegacyTelegramIdentityInput,
): Promise<LegacyTelegramImportResult> {
  const [byUser, byExternal] = await Promise.all([
    db.messagingIdentity.findUnique({
      where: {
        userId_channel: {
          userId: input.userId,
          channel: MessagingChannel.TELEGRAM,
        },
      },
    }),
    db.messagingIdentity.findUnique({
      where: {
        channel_externalUserId: {
          channel: MessagingChannel.TELEGRAM,
          externalUserId: input.telegramUserId,
        },
      },
    }),
  ]);

  if (!byUser && !byExternal) {
    return { status: 'would_create' };
  }

  if (
    byUser &&
    byExternal &&
    byUser.id === byExternal.id &&
    byUser.userId === input.userId &&
    byUser.externalUserId === input.telegramUserId
  ) {
    return { status: 'already_synced' };
  }

  if (byUser && byUser.externalUserId !== input.telegramUserId) {
    return { status: 'conflict', reason: 'user_channel_taken' };
  }

  if (byExternal && byExternal.userId !== input.userId) {
    return { status: 'conflict', reason: 'external_identity_taken' };
  }

  return { status: 'conflict', reason: 'inconsistent_identity' };
}

export function createMessagingRepository(db: MessagingDatabase) {
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
    createIdentity(input: CreateMessagingIdentityInput) {
      return db.messagingIdentity.create({
        data: {
          userId: input.userId,
          channel: input.channel,
          externalUserId: input.externalUserId,
          destinationId: input.destinationId,
          status: input.status,
          verifiedAt: input.verifiedAt,
          verificationMethod: input.verificationMethod,
          legacySource: input.legacySource,
        },
      });
    },

    findIdentityByUserAndChannel(
      userId: string,
      channel: MessagingChannel,
    ) {
      return db.messagingIdentity.findUnique({
        where: { userId_channel: { userId, channel } },
      });
    },

    findIdentityByExternalId(
      channel: MessagingChannel,
      externalUserId: string,
    ) {
      return db.messagingIdentity.findUnique({
        where: {
          channel_externalUserId: { channel, externalUserId },
        },
      });
    },

    createLinkChallenge(input: CreateMessagingLinkChallengeInput) {
      if (!input.tokenHash.trim()) {
        throw new Error('messaging_challenge_hash_required');
      }

      return db.messagingLinkChallenge.create({
        data: {
          userId: input.userId,
          channel: input.channel,
          externalUserId: input.externalUserId,
          destinationId: input.destinationId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
        },
      });
    },

    findValidLinkChallenge(tokenHash: string, now = new Date()) {
      return db.messagingLinkChallenge.findFirst({
        where: {
          tokenHash,
          consumedAt: null,
          expiresAt: { gt: now },
        },
      });
    },

    inspectLegacyTelegramIdentity(input: LegacyTelegramIdentityInput) {
      return inspectLegacyTelegramIdentity(db, input);
    },

    async importLegacyTelegramIdentity(
      input: LegacyTelegramIdentityInput,
    ): Promise<LegacyTelegramImportResult> {
      try {
        return await serializable(async (tx) => {
          const inspected = await inspectLegacyTelegramIdentity(tx, input);
          if (inspected.status !== 'would_create') {
            return inspected;
          }

          await tx.messagingIdentity.create({
            data: {
              userId: input.userId,
              channel: MessagingChannel.TELEGRAM,
              externalUserId: input.telegramUserId,
              destinationId: input.telegramUserId,
              // Imported rows are bindings, but not newly verified identities.
              verifiedAt: null,
              verificationMethod: LEGACY_VERIFICATION_METHOD,
              legacySource: LEGACY_SOURCE,
            },
          });

          return { status: 'created' };
        });
      } catch (error) {
        // A concurrent worker may create the exact row after inspection.
        // Re-inspection turns that race into idempotency or an explicit conflict.
        if ((error as { code?: string }).code === 'P2002') {
          const inspected = await inspectLegacyTelegramIdentity(db, input);
          if (inspected.status !== 'would_create') {
            return inspected;
          }
        }
        throw error;
      }
    },
  };
}
