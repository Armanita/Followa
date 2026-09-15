import type {
  MessagingChannel,
  MessagingIdentityStatus,
  PrismaClient,
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

type MessagingDatabase = Pick<
  PrismaClient,
  'messagingIdentity' | 'messagingLinkChallenge'
>;

export function createMessagingRepository(db: MessagingDatabase) {
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
  };
}
