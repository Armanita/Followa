import { MessagingChannel, NotificationType, Prisma, type PrismaClient } from '@prisma/client';
import { resolveNotificationPolicy } from './messaging-policy.js';
import { findActiveRecipientMembership, resolveNotificationCompany } from './notification-context.js';

export type MultiChannelNotificationInput = {
  userId: string;
  companyId?: string;
  type: NotificationType;
  title: string;
  body?: string;
  linkType?: string;
  linkId?: string;
};

type Database = Prisma.TransactionClient;
const CHANNELS = [MessagingChannel.TELEGRAM, MessagingChannel.BALE] as const;

async function destinationFor(db: Database, userId: string, channel: MessagingChannel) {
  if (channel === MessagingChannel.TELEGRAM) {
    const legacy = await db.telegramIdentity.findUnique({ where: { userId } });
    return legacy ? { destinationId: legacy.telegramUserId, messagingIdentityId: null, identityVersion: null } : null;
  }
  if (channel === MessagingChannel.BALE) {
    const identity = await db.messagingIdentity.findUnique({
      where: { userId_channel: { userId, channel } },
    });
    if (!identity || identity.status !== 'ACTIVE' || !identity.verifiedAt) return null;
    const destinationId = identity.destinationId ?? identity.externalUserId;
    return { destinationId, messagingIdentityId: identity.id, identityVersion: identity.version };
  }
  return null;
}

export function createNotificationDispatcher(client: PrismaClient) {
  return {
    async enqueue(input: MultiChannelNotificationInput) {
      return client.$transaction(async (tx) => {
        const companyId = await resolveNotificationCompany(tx, input);
        const notification = await tx.notification.create({
          data: {
            userId: input.userId,
            companyId,
            type: input.type,
            title: input.title,
            body: input.body,
            linkType: input.linkType,
            linkId: input.linkId,
          },
        });

        // In-app delivery always exists. Ambiguous context or title-only
        // notifications intentionally create no external jobs.
        if (!companyId || input.body === undefined) return notification;
        const membership = await findActiveRecipientMembership(tx, input.userId, companyId);
        if (!membership?.isActive || !membership.company.isActive) return notification;

        const [systems, companies, preferences] = await Promise.all([
          tx.messagingSystemPolicy.findMany({ where: { channel: { in: [...CHANNELS] } } }),
          tx.companyMessagingPolicy.findMany({ where: { companyId, channel: { in: [...CHANNELS] } } }),
          tx.membershipMessagingPreference.findMany({ where: { membershipId: membership.id, channel: { in: [...CHANNELS] } } }),
        ]);
        const systemMap = new Map(systems.map((row) => [row.channel, row]));
        const companyMap = new Map(companies.map((row) => [row.channel, row.notificationEnabled]));
        const preferenceMap = new Map(preferences.map((row) => [row.channel, row.notificationEnabled]));

        for (const channel of CHANNELS) {
          const system = systemMap.get(channel);
          const allowed = resolveNotificationPolicy({
            systemEnabled: system?.enabled ?? false,
            systemNotificationEnabled: system?.notificationEnabled ?? false,
            companyPreference: companyMap.get(channel) ?? null,
            membershipPreference: preferenceMap.get(channel) ?? null,
          }).enabled;
          if (!allowed) continue;
          const destination = await destinationFor(tx, input.userId, channel);
          if (!destination) continue;
          await tx.notificationDelivery.create({
            data: { notificationId: notification.id, channel, ...destination },
          });
        }
        return notification;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    },
  };
}
