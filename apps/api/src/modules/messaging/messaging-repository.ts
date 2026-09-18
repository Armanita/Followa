import {
  MessagingChannel,
  MessagingIdentityStatus,
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

export type BeginLinkChallengeInput = {
  mobile: string;
  channel: MessagingChannel;
  externalUserId: string;
  destinationId: string;
  tokenHash: string;
  expiresAt: Date;
};

export type BeginLinkChallengeResult =
  | { status: 'created' }
  | {
      status: 'rejected';
      reason:
        | 'user_not_eligible'
        | 'identity_already_linked'
        | 'identity_conflict';
    };

export type ConfirmLinkChallengeInput = {
  channel: MessagingChannel;
  externalUserId: string;
  tokenHash: string;
  verificationMethod: string;
};

export type ConfirmLinkChallengeResult =
  | { status: 'connected'; userId: string }
  | {
      status: 'rejected';
      reason:
        | 'invalid_confirmation'
        | 'user_not_eligible'
        | 'identity_already_linked'
        | 'identity_conflict';
    };

type MessagingDatabase = Pick<
  PrismaClient,
  'user' | 'messagingIdentity' | 'messagingLinkChallenge' | '$transaction'
>;

type IdentityReader = Pick<
  Prisma.TransactionClient,
  'messagingIdentity'
>;

const LEGACY_SOURCE = 'telegram_identities';
const LEGACY_VERIFICATION_METHOD = 'LEGACY_IMPORT_UNVERIFIED';
const eligibleMembership = {
  some: {
    isActive: true,
    company: { isActive: true },
  },
};

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

    beginLinkChallenge(
      input: BeginLinkChallengeInput,
    ): Promise<BeginLinkChallengeResult> {
      if (!input.tokenHash.trim()) {
        throw new Error('messaging_challenge_hash_required');
      }

      return serializable(async (tx) => {
        const user = await tx.user.findFirst({
          where: {
            mobile: input.mobile,
            memberships: eligibleMembership,
          },
          select: { id: true },
        });
        if (!user) {
          return { status: 'rejected', reason: 'user_not_eligible' };
        }

        const [byUser, byExternal] = await Promise.all([
          tx.messagingIdentity.findUnique({
            where: {
              userId_channel: {
                userId: user.id,
                channel: input.channel,
              },
            },
          }),
          tx.messagingIdentity.findUnique({
            where: {
              channel_externalUserId: {
                channel: input.channel,
                externalUserId: input.externalUserId,
              },
            },
          }),
        ]);

        if (
          byUser &&
          byExternal &&
          byUser.id === byExternal.id &&
          byUser.userId === user.id &&
          byUser.externalUserId === input.externalUserId
        ) {
          return {
            status: 'rejected',
            reason: 'identity_already_linked',
          };
        }
        if (byUser || byExternal) {
          return { status: 'rejected', reason: 'identity_conflict' };
        }

        const now = new Date();
        await tx.messagingLinkChallenge.updateMany({
          where: {
            consumedAt: null,
            OR: [
              { userId: user.id, channel: input.channel },
              {
                channel: input.channel,
                externalUserId: input.externalUserId,
              },
            ],
          },
          data: { consumedAt: now },
        });
        await tx.messagingLinkChallenge.create({
          data: {
            userId: user.id,
            channel: input.channel,
            externalUserId: input.externalUserId,
            destinationId: input.destinationId,
            tokenHash: input.tokenHash,
            expiresAt: input.expiresAt,
          },
        });

        return { status: 'created' };
      });
    },

    cancelLinkChallenge(tokenHash: string) {
      return db.messagingLinkChallenge.updateMany({
        where: { tokenHash, consumedAt: null },
        data: { consumedAt: new Date() },
      });
    },

    async confirmLinkChallenge(
      input: ConfirmLinkChallengeInput,
    ): Promise<ConfirmLinkChallengeResult> {
      try {
        return await serializable(async (tx) => {
          const now = new Date();
          const challenge = await tx.messagingLinkChallenge.findUnique({
            where: { tokenHash: input.tokenHash },
          });
          if (
            !challenge ||
            challenge.channel !== input.channel ||
            challenge.externalUserId !== input.externalUserId ||
            challenge.consumedAt ||
            challenge.expiresAt <= now
          ) {
            return {
              status: 'rejected',
              reason: 'invalid_confirmation',
            };
          }

          const user = await tx.user.findFirst({
            where: {
              id: challenge.userId,
              memberships: eligibleMembership,
            },
            select: { id: true },
          });
          if (!user) {
            return { status: 'rejected', reason: 'user_not_eligible' };
          }

          const [byUser, byExternal] = await Promise.all([
            tx.messagingIdentity.findUnique({
              where: {
                userId_channel: {
                  userId: user.id,
                  channel: input.channel,
                },
              },
            }),
            tx.messagingIdentity.findUnique({
              where: {
                channel_externalUserId: {
                  channel: input.channel,
                  externalUserId: input.externalUserId,
                },
              },
            }),
          ]);
          if (
            byUser &&
            byExternal &&
            byUser.id === byExternal.id &&
            byUser.userId === user.id &&
            byUser.externalUserId === input.externalUserId
          ) {
            return {
              status: 'rejected',
              reason: 'identity_already_linked',
            };
          }
          if (byUser || byExternal) {
            return { status: 'rejected', reason: 'identity_conflict' };
          }

          const consumed = await tx.messagingLinkChallenge.updateMany({
            where: {
              id: challenge.id,
              tokenHash: input.tokenHash,
              channel: input.channel,
              externalUserId: input.externalUserId,
              consumedAt: null,
              expiresAt: { gt: now },
            },
            data: { consumedAt: now },
          });
          if (consumed.count !== 1) {
            return {
              status: 'rejected',
              reason: 'invalid_confirmation',
            };
          }

          await tx.messagingIdentity.create({
            data: {
              userId: user.id,
              channel: input.channel,
              externalUserId: input.externalUserId,
              destinationId:
                challenge.destinationId ?? input.externalUserId,
              status: MessagingIdentityStatus.ACTIVE,
              verifiedAt: now,
              verificationMethod: input.verificationMethod,
            },
          });

          await tx.messagingLinkChallenge.updateMany({
            where: {
              id: { not: challenge.id },
              consumedAt: null,
              OR: [
                { userId: user.id, channel: input.channel },
                {
                  channel: input.channel,
                  externalUserId: input.externalUserId,
                },
              ],
            },
            data: { consumedAt: now },
          });

          return { status: 'connected', userId: user.id };
        });
      } catch (error) {
        // Uniqueness races roll the token consumption back with the identity.
        if ((error as { code?: string }).code === 'P2002') {
          return { status: 'rejected', reason: 'identity_conflict' };
        }
        throw error;
      }
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


export type OperationalTelegramIdentity = {
  userId: string;
  telegramUserId: string;
  messagingIdentityId: string | null;
  identityVersion: number | null;
};

type TelegramIdentityReadDatabase = Pick<
  Prisma.TransactionClient,
  'messagingIdentity'
>;

function operationalGenericTelegramIdentity(identity: {
  id: string;
  userId: string;
  externalUserId: string;
  destinationId: string | null;
  status: MessagingIdentityStatus;
  verifiedAt: Date | null;
  version: number;
} | null): OperationalTelegramIdentity | null {
  if (
    !identity ||
    identity.status !== MessagingIdentityStatus.ACTIVE ||
    !identity.verifiedAt
  ) {
    return null;
  }
  return {
    userId: identity.userId,
    telegramUserId: identity.destinationId ?? identity.externalUserId,
    messagingIdentityId: identity.id,
    identityVersion: identity.version,
  };
}

/**
 * Phase 2: MessagingIdentity is the only runtime source.
 * The readFromGeneric flag is kept for signature compatibility but ignored.
 * Legacy TelegramIdentity is no longer read.
 */
export async function findOperationalTelegramIdentityByUserId(
  db: TelegramIdentityReadDatabase,
  userId: string,
  _readFromGeneric: boolean,
): Promise<OperationalTelegramIdentity | null> {
  const identity = await db.messagingIdentity.findUnique({
    where: {
      userId_channel: { userId, channel: MessagingChannel.TELEGRAM },
    },
    select: {
      id: true,
      userId: true,
      externalUserId: true,
      destinationId: true,
      status: true,
      verifiedAt: true,
      version: true,
    },
  });
  return operationalGenericTelegramIdentity(identity);
}

export async function findOperationalTelegramIdentityByExternalId(
  db: TelegramIdentityReadDatabase,
  telegramUserId: string,
  _readFromGeneric: boolean,
): Promise<OperationalTelegramIdentity | null> {
  const identity = await db.messagingIdentity.findUnique({
    where: {
      channel_externalUserId: {
        channel: MessagingChannel.TELEGRAM,
        externalUserId: telegramUserId,
      },
    },
    select: {
      id: true,
      userId: true,
      externalUserId: true,
      destinationId: true,
      status: true,
      verifiedAt: true,
      version: true,
    },
  });
  return operationalGenericTelegramIdentity(identity);
}
