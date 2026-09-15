import {
  MessagingChannel,
  NotificationDeliveryAttemptOutcome,
  NotificationDeliveryStatus,
  Prisma,
  type PrismaClient,
} from '@prisma/client';

export type CreateDeliveryInput = {
  notificationId: string;
  channel: MessagingChannel;
  destinationId: string;
  messagingIdentityId?: string | null;
  identityVersion?: number | null;
  availableAt?: Date;
};

export type RecordAttemptInput = {
  deliveryId: string;
  outcome: NotificationDeliveryAttemptOutcome;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  retryAt?: Date | null;
};

const MAX_SERIALIZABLE_RETRIES = 3;

async function serializable<T>(client: PrismaClient, operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await client.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034' || attempt >= MAX_SERIALIZABLE_RETRIES) throw error;
    }
  }
}

export function createDeliveryRepository(client: PrismaClient) {
  return {
    /**
     * Idempotently creates a channel job. Existing jobs are intentionally not
     * retargeted: the destination/identity snapshot belongs to the first job.
     */
    create(input: CreateDeliveryInput) {
      if (!input.destinationId.trim()) throw new Error('delivery destination is required');
      if ((input.messagingIdentityId == null) !== (input.identityVersion == null)) {
        throw new Error('identity id and version must be supplied together');
      }
      if (input.identityVersion !== undefined && input.identityVersion !== null && input.identityVersion < 1) {
        throw new Error('identity version must be positive');
      }
      return client.notificationDelivery.upsert({
        where: { notificationId_channel: { notificationId: input.notificationId, channel: input.channel } },
        create: {
          notificationId: input.notificationId,
          channel: input.channel,
          destinationId: input.destinationId,
          messagingIdentityId: input.messagingIdentityId ?? null,
          identityVersion: input.identityVersion ?? null,
          availableAt: input.availableAt,
        },
        update: {},
      });
    },

    listForNotification(notificationId: string) {
      return client.notificationDelivery.findMany({
        where: { notificationId },
        include: { attempts: { orderBy: { attemptNumber: 'asc' } } },
        orderBy: { channel: 'asc' },
      });
    },

    /** Records one immutable attempt and updates the delivery summary atomically. */
    recordAttempt(input: RecordAttemptInput) {
      return serializable(client, async (tx) => {
        const now = new Date();
        const sent = input.outcome === NotificationDeliveryAttemptOutcome.SENT;
        const current = await tx.notificationDelivery.findUniqueOrThrow({ where: { id: input.deliveryId } });
        if (current.status === NotificationDeliveryStatus.SENT || current.status === NotificationDeliveryStatus.CANCELLED) {
          throw new Error('terminal delivery cannot receive another attempt');
        }
        const delivery = await tx.notificationDelivery.update({
          where: { id: input.deliveryId },
          data: {
            attemptCount: { increment: 1 },
            status: sent ? NotificationDeliveryStatus.SENT : NotificationDeliveryStatus.FAILED,
            lastAttemptAt: now,
            sentAt: sent ? now : null,
            providerMessageId: sent ? input.providerMessageId ?? null : null,
            lastError: sent ? null : input.errorMessage ?? 'delivery_failed',
            availableAt: !sent && input.retryAt ? input.retryAt : undefined,
          },
        });
        await tx.notificationDeliveryAttempt.create({
          data: {
            deliveryId: delivery.id,
            attemptNumber: delivery.attemptCount,
            outcome: input.outcome,
            errorMessage: sent ? null : input.errorMessage ?? 'delivery_failed',
            attemptedAt: now,
          },
        });
        return delivery;
      });
    },

    cancel(deliveryId: string) {
      return client.notificationDelivery.updateMany({
        where: { id: deliveryId, status: { in: [NotificationDeliveryStatus.PENDING, NotificationDeliveryStatus.FAILED] } },
        data: { status: NotificationDeliveryStatus.CANCELLED, cancelledAt: new Date() },
      });
    },
  };
}
