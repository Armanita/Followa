import {
  MessagingChannel,
  NotificationDeliveryAttemptOutcome,
  NotificationDeliveryStatus,
} from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { createDeliveryRepository } from '../src/modules/messaging/delivery-repository.js';
import { cleanup, closeTestApp, getTestApp, seedFixture } from './helpers.js';

describe('notification delivery ledger', () => {
  const repository = createDeliveryRepository(prisma);
  let fixture: Awaited<ReturnType<typeof seedFixture>>;
  let notificationId: string;

  beforeAll(async () => {
    await getTestApp();
    fixture = await seedFixture(1);
  });

  beforeEach(async () => {
    const notification = await prisma.notification.create({
      data: {
        userId: fixture.employees[0]!.id,
        companyId: fixture.company.id,
        type: 'CASE_UPDATED',
        title: 'آزمون وضعیت تحویل',
        body: 'این اعلان نباید در P7 ارسال شود.',
      },
    });
    notificationId = notification.id;
  });

  afterAll(async () => {
    await cleanup();
    await closeTestApp();
  });

  async function createJobs() {
    await repository.create({ notificationId, channel: MessagingChannel.TELEGRAM, destinationId: 'telegram-100' });
    await repository.create({ notificationId, channel: MessagingChannel.BALE, destinationId: 'bale-200' });
  }

  it('keeps legacy notifications valid with nullable company context', async () => {
    const legacy = await prisma.notification.create({
      data: {
        userId: fixture.employees[0]!.id,
        type: 'CASE_UPDATED',
        title: 'اعلان قدیمی',
      },
    });
    expect(legacy.companyId).toBeNull();
    const readAt = new Date();
    const read = await prisma.notification.update({ where: { id: legacy.id }, data: { readAt } });
    expect(read.readAt).toEqual(readAt);
  });

  it('creates independent Telegram and Bale deliveries', async () => {
    await createJobs();
    const deliveries = await repository.listForNotification(notificationId);
    expect(deliveries).toHaveLength(2);
    expect(deliveries.map((row) => row.channel)).toEqual([MessagingChannel.TELEGRAM, MessagingChannel.BALE]);
    expect(deliveries.every((row) => row.status === NotificationDeliveryStatus.PENDING)).toBe(true);
  });

  it('does not duplicate or retarget an existing channel job', async () => {
    const identity = await prisma.messagingIdentity.create({ data: {
      userId: fixture.employees[0]!.id,
      channel: MessagingChannel.TELEGRAM,
      externalUserId: 'telegram-100',
      destinationId: 'telegram-100',
      status: 'ACTIVE',
      verifiedAt: new Date(),
      verificationMethod: 'TEST',
    } });
    const original = await repository.create({
      notificationId,
      channel: MessagingChannel.TELEGRAM,
      destinationId: 'telegram-100',
      messagingIdentityId: identity.id,
      identityVersion: identity.version,
    });
    const duplicate = await repository.create({
      notificationId,
      channel: MessagingChannel.TELEGRAM,
      destinationId: 'attacker-controlled-destination',
      messagingIdentityId: identity.id,
      identityVersion: identity.version + 1,
    });
    expect(duplicate.id).toBe(original.id);
    expect(duplicate.destinationId).toBe('telegram-100');
    expect(duplicate.identityVersion).toBe(identity.version);
    expect(await prisma.notificationDelivery.count({ where: { notificationId, channel: MessagingChannel.TELEGRAM } })).toBe(1);
  });

  it('records immutable attempt history and channel status independently', async () => {
    await createJobs();
    const telegram = await prisma.notificationDelivery.findUniqueOrThrow({
      where: { notificationId_channel: { notificationId, channel: MessagingChannel.TELEGRAM } },
    });
    const bale = await prisma.notificationDelivery.findUniqueOrThrow({
      where: { notificationId_channel: { notificationId, channel: MessagingChannel.BALE } },
    });

    await repository.recordAttempt({
      deliveryId: bale.id,
      outcome: NotificationDeliveryAttemptOutcome.FAILED,
      errorMessage: 'provider_timeout',
      retryAt: new Date(Date.now() + 60_000),
    });
    await repository.recordAttempt({
      deliveryId: bale.id,
      outcome: NotificationDeliveryAttemptOutcome.SENT,
      providerMessageId: 'bale-message-1',
    });

    const updatedBale = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: bale.id }, include: { attempts: { orderBy: { attemptNumber: 'asc' } } } });
    const unchangedTelegram = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: telegram.id } });
    expect(updatedBale.status).toBe(NotificationDeliveryStatus.SENT);
    expect(updatedBale.attemptCount).toBe(2);
    expect(updatedBale.attempts.map((attempt) => attempt.outcome)).toEqual([
      NotificationDeliveryAttemptOutcome.FAILED,
      NotificationDeliveryAttemptOutcome.SENT,
    ]);
    expect(unchangedTelegram.status).toBe(NotificationDeliveryStatus.PENDING);
    expect(unchangedTelegram.attemptCount).toBe(0);
  });

  it('cancels only pending or failed deliveries without erasing history', async () => {
    await createJobs();
    const telegram = await prisma.notificationDelivery.findUniqueOrThrow({
      where: { notificationId_channel: { notificationId, channel: MessagingChannel.TELEGRAM } },
    });
    expect((await repository.cancel(telegram.id)).count).toBe(1);
    expect((await repository.cancel(telegram.id)).count).toBe(0);
    const cancelled = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: telegram.id } });
    expect(cancelled.status).toBe(NotificationDeliveryStatus.CANCELLED);
    expect(cancelled.cancelledAt).not.toBeNull();
  });
});
