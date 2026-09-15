import {
  MessagingChannel,
  MessagingIdentityStatus,
} from '@prisma/client';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import {
  createMessagingRepository,
} from '../src/modules/messaging/messaging-repository.js';
import {
  closeTestApp,
  getTestApp,
  seedFixture,
} from './helpers.js';

let fixture: Awaited<ReturnType<typeof seedFixture>>;
let repository: ReturnType<typeof createMessagingRepository>;
let userIds: string[];
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function externalId(suffix: string) {
  return `p3-${runId}-${suffix}`;
}

function tokenHash(suffix: string) {
  return suffix.padEnd(64, '0').slice(0, 64);
}

beforeAll(async () => {
  await getTestApp();
  fixture = await seedFixture(1);
  userIds = [fixture.manager.id, fixture.employees[0]!.id];
  repository = createMessagingRepository(prisma);
});

beforeEach(async () => {
  await prisma.messagingLinkChallenge.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.messagingIdentity.deleteMany({
    where: { userId: { in: userIds } },
  });
});

afterAll(async () => {
  await fixture?.cleanup();
  await closeTestApp();
});

describe('generic messaging identity schema', () => {
  it('allows the same external value in independent channels', async () => {
    const shared = externalId('shared');

    const telegram = await repository.createIdentity({
      userId: fixture.manager.id,
      channel: MessagingChannel.TELEGRAM,
      externalUserId: shared,
      destinationId: shared,
      verifiedAt: new Date(),
      verificationMethod: 'P3_TEST',
    });
    const bale = await repository.createIdentity({
      userId: fixture.manager.id,
      channel: MessagingChannel.BALE,
      externalUserId: shared,
      destinationId: shared,
      verifiedAt: new Date(),
      verificationMethod: 'P3_TEST',
    });

    expect(telegram.channel).toBe(MessagingChannel.TELEGRAM);
    expect(bale.channel).toBe(MessagingChannel.BALE);
    expect(await prisma.messagingIdentity.count({
      where: { userId: fixture.manager.id },
    })).toBe(2);
  });

  it('rejects one provider identity being assigned to another user', async () => {
    const shared = externalId('owned');
    await repository.createIdentity({
      userId: fixture.manager.id,
      channel: MessagingChannel.TELEGRAM,
      externalUserId: shared,
    });

    await expect(repository.createIdentity({
      userId: fixture.employees[0]!.id,
      channel: MessagingChannel.TELEGRAM,
      externalUserId: shared,
    })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rejects a second identity for the same user and channel', async () => {
    await repository.createIdentity({
      userId: fixture.manager.id,
      channel: MessagingChannel.TELEGRAM,
      externalUserId: externalId('first'),
    });

    await expect(repository.createIdentity({
      userId: fixture.manager.id,
      channel: MessagingChannel.TELEGRAM,
      externalUserId: externalId('second'),
    })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('uses explicit defaults and compound lookup keys', async () => {
    const created = await repository.createIdentity({
      userId: fixture.manager.id,
      channel: MessagingChannel.EITAA,
      externalUserId: externalId('lookup'),
    });

    expect(created.status).toBe(MessagingIdentityStatus.ACTIVE);
    expect(created.version).toBe(1);
    expect(
      await repository.findIdentityByUserAndChannel(
        fixture.manager.id,
        MessagingChannel.EITAA,
      ),
    ).toMatchObject({ id: created.id });
    expect(
      await repository.findIdentityByExternalId(
        MessagingChannel.EITAA,
        created.externalUserId,
      ),
    ).toMatchObject({ id: created.id });
  });

  it('stores only a challenge hash and enforces one-time hash uniqueness', async () => {
    const hash = tokenHash('challenge');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const challenge = await repository.createLinkChallenge({
      userId: fixture.manager.id,
      channel: MessagingChannel.BALE,
      externalUserId: externalId('challenge'),
      tokenHash: hash,
      expiresAt,
    });

    expect(challenge.tokenHash).toBe(hash);
    expect('token' in challenge).toBe(false);
    expect(await repository.findValidLinkChallenge(hash))
      .toMatchObject({ id: challenge.id });

    await expect(repository.createLinkChallenge({
      userId: fixture.employees[0]!.id,
      channel: MessagingChannel.BALE,
      externalUserId: externalId('other-challenge'),
      tokenHash: hash,
      expiresAt,
    })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('does not return expired or consumed challenges as valid', async () => {
    const expiredHash = tokenHash('expired');
    const consumedHash = tokenHash('consumed');

    await repository.createLinkChallenge({
      userId: fixture.manager.id,
      channel: MessagingChannel.TELEGRAM,
      externalUserId: externalId('expired'),
      tokenHash: expiredHash,
      expiresAt: new Date(Date.now() - 1),
    });
    const consumed = await repository.createLinkChallenge({
      userId: fixture.manager.id,
      channel: MessagingChannel.TELEGRAM,
      externalUserId: externalId('consumed'),
      tokenHash: consumedHash,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await prisma.messagingLinkChallenge.update({
      where: { id: consumed.id },
      data: { consumedAt: new Date() },
    });

    expect(await repository.findValidLinkChallenge(expiredHash)).toBeNull();
    expect(await repository.findValidLinkChallenge(consumedHash)).toBeNull();
  });

  it('does not write legacy Telegram tables', async () => {
    const identityCount = await prisma.telegramIdentity.count({
      where: { userId: { in: userIds } },
    });
    const pendingCount = await prisma.telegramPendingConnection.count({
      where: { userId: { in: userIds } },
    });

    await repository.createIdentity({
      userId: fixture.manager.id,
      channel: MessagingChannel.WHATSAPP,
      externalUserId: externalId('legacy-isolation'),
    });
    await repository.createLinkChallenge({
      userId: fixture.manager.id,
      channel: MessagingChannel.SMS,
      externalUserId: externalId('sms'),
      tokenHash: tokenHash('legacy-isolation'),
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(await prisma.telegramIdentity.count({
      where: { userId: { in: userIds } },
    })).toBe(identityCount);
    expect(await prisma.telegramPendingConnection.count({
      where: { userId: { in: userIds } },
    })).toBe(pendingCount);
  });
});
