import { MessagingChannel, NotificationDeliveryStatus } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { createDeliveryWorker } from '../src/modules/messaging/delivery-worker.js';
import { createNotificationDispatcher } from '../src/modules/messaging/notification-dispatcher.js';
import { encryptProviderCredentials } from '../src/modules/messaging/provider-configuration.js';
import type { MessagingProvider } from '../src/modules/messaging/messaging-types.js';
import { cleanup, closeTestApp, getTestApp, seedFixture } from './helpers.js';

function provider(name: 'telegram' | 'bale', calls: string[], failure?: Error): MessagingProvider {
  return {
    name,
    async send(request) {
      calls.push(request.destination);
      if (failure) throw failure;
    },
  };
}

describe('P8 multi-channel notifications', () => {
  const dispatcher = createNotificationDispatcher(prisma);
  let fixture: Awaited<ReturnType<typeof seedFixture>>;
  let telegramCalls: string[];
  let baleCalls: string[];

  beforeAll(async () => {
    await getTestApp();
    fixture = await seedFixture(1);
    telegramCalls = [];
    baleCalls = [];
    await prisma.messagingSystemPolicy.deleteMany({ where: { channel: { in: [MessagingChannel.TELEGRAM, MessagingChannel.BALE] } } });
    await prisma.messagingSystemPolicy.createMany({ data: [
      { channel: MessagingChannel.TELEGRAM, enabled: true, notificationEnabled: true, otpEnabled: false, credentialsEncrypted: encryptProviderCredentials({ botToken: 'test-telegram-token' }, 'test-only-master-key-with-at-least-32-characters') },
      { channel: MessagingChannel.BALE, enabled: true, notificationEnabled: true, otpEnabled: false, credentialsEncrypted: encryptProviderCredentials({ botToken: 'test-bale-token' }, 'test-only-master-key-with-at-least-32-characters') },
    ] });
    const userId = fixture.employees[0]!.id;
    await prisma.messagingIdentity.create({ data: { userId, channel: MessagingChannel.TELEGRAM, externalUserId: `tg-${userId}`, destinationId: `tg-${userId}`, verifiedAt: new Date(), status: 'ACTIVE', verificationMethod: 'TEST' } });
    await prisma.messagingIdentity.create({ data: {
      userId,
      channel: MessagingChannel.BALE,
      externalUserId: `bale-${userId}`,
      destinationId: `bale-${userId}`,
      verifiedAt: new Date(),
      verificationMethod: 'TEST',
    } });
  });

  afterAll(async () => {
    await prisma.messagingSystemPolicy.deleteMany({ where: { channel: { in: [MessagingChannel.TELEGRAM, MessagingChannel.BALE] } } });
    await cleanup();
    await closeTestApp();
  });

  async function enqueue(title: string) {
    return dispatcher.enqueue({
      userId: fixture.employees[0]!.id,
      companyId: fixture.company.id,
      type: 'CASE_UPDATED',
      title,
      body: 'متن تست',
    });
  }

  function worker(baleFailure?: Error) {
    return createDeliveryWorker(prisma, {
      [MessagingChannel.TELEGRAM]: provider('telegram', telegramCalls),
      [MessagingChannel.BALE]: provider('bale', baleCalls, baleFailure),
    }, { leaseMs: 30_000, maxAttempts: 3 });
  }

  it('creates one in-app notification and independent jobs for both channels', async () => {
    const notification = await enqueue('هر دو کانال');
    expect(await prisma.notification.count({ where: { id: notification.id } })).toBe(1);
    expect(await prisma.notificationDelivery.count({ where: { notificationId: notification.id } })).toBe(2);
    const activeWorker = worker();
    await activeWorker.runOnce();
    await activeWorker.runOnce();
    const deliveries = await prisma.notificationDelivery.findMany({ where: { notificationId: notification.id } });
    expect(deliveries.every((row) => row.status === NotificationDeliveryStatus.SENT)).toBe(true);
    expect(telegramCalls).toContain(`tg-${fixture.employees[0]!.id}`);
    expect(baleCalls).toContain(`bale-${fixture.employees[0]!.id}`);
  });

  it('supports explicit none without removing the in-app notification', async () => {
    await prisma.membershipMessagingPreference.createMany({ data: [
      { membershipId: fixture.employees[0]!.membershipId, channel: MessagingChannel.TELEGRAM, notificationEnabled: false },
      { membershipId: fixture.employees[0]!.membershipId, channel: MessagingChannel.BALE, notificationEnabled: false },
    ] });
    const notification = await enqueue('بدون کانال خارجی');
    expect(await prisma.notification.findUnique({ where: { id: notification.id } })).not.toBeNull();
    expect(await prisma.notificationDelivery.count({ where: { notificationId: notification.id } })).toBe(0);
    await prisma.membershipMessagingPreference.deleteMany({ where: { membershipId: fixture.employees[0]!.membershipId } });
  });

  it('isolates a Bale failure from a successful Telegram delivery', async () => {
    const notification = await enqueue('شکست جزئی');
    const partialWorker = worker(new Error('bale unavailable'));
    await partialWorker.runOnce();
    await partialWorker.runOnce();
    const telegram = await prisma.notificationDelivery.findUniqueOrThrow({ where: { notificationId_channel: { notificationId: notification.id, channel: MessagingChannel.TELEGRAM } } });
    const bale = await prisma.notificationDelivery.findUniqueOrThrow({ where: { notificationId_channel: { notificationId: notification.id, channel: MessagingChannel.BALE } } });
    expect(telegram.status).toBe(NotificationDeliveryStatus.SENT);
    expect(bale.status).toBe(NotificationDeliveryStatus.FAILED);
    expect(bale.attemptCount).toBe(1);
  });

  it('cancels queued jobs when the company is disabled before send', async () => {
    const notification = await enqueue('شرکت غیرفعال');
    await prisma.company.update({ where: { id: fixture.company.id }, data: { isActive: false } });
    const activeWorker = worker();
    await activeWorker.runOnce();
    await activeWorker.runOnce();
    const deliveries = await prisma.notificationDelivery.findMany({ where: { notificationId: notification.id } });
    expect(deliveries.every((row) => row.status === NotificationDeliveryStatus.CANCELLED)).toBe(true);
    expect(deliveries.every((row) => row.attemptCount === 0)).toBe(true);
    await prisma.company.update({ where: { id: fixture.company.id }, data: { isActive: true } });
  });

  it('does not redirect a queued Bale job after identity changes', async () => {
    const notification = await enqueue('تغییر مقصد');
    await prisma.messagingIdentity.update({
      where: { userId_channel: { userId: fixture.employees[0]!.id, channel: MessagingChannel.BALE } },
      data: { destinationId: 'new-bale-destination', version: { increment: 1 } },
    });
    const activeWorker = worker();
    await activeWorker.runOnce();
    await activeWorker.runOnce();
    const bale = await prisma.notificationDelivery.findUniqueOrThrow({ where: { notificationId_channel: { notificationId: notification.id, channel: MessagingChannel.BALE } } });
    expect(bale.status).toBe(NotificationDeliveryStatus.CANCELLED);
    expect(bale.lastError).toBe('identity_snapshot_changed');
    expect(baleCalls).not.toContain('new-bale-destination');
  });

  it('does not create external jobs for ambiguous context', async () => {
    const notification = await dispatcher.enqueue({
      userId: fixture.employees[0]!.id,
      type: 'CASE_UPDATED',
      title: 'بدون زمینه',
      body: 'متن تست',
      linkType: 'UNKNOWN',
      linkId: 'unknown',
    });
    expect(notification.companyId).toBeNull();
    expect(await prisma.notificationDelivery.count({ where: { notificationId: notification.id } })).toBe(0);
  });
});
