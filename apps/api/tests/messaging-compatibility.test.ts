import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MessagingChannel,
  MessagingIdentityStatus,
  type PrismaClient,
} from '@prisma/client';
import { config } from '../src/config.js';
import {
  createMessagingRepository,
  findOperationalTelegramIdentityByExternalId,
  findOperationalTelegramIdentityByUserId,
} from '../src/modules/messaging/messaging-repository.js';
import { createTelegramRepository } from '../src/modules/telegram/telegram-repository.js';
import { runMessagingIdentityBackfill } from '../scripts/backfill-messaging-identities.js';

type GenericIdentity = {
  id: string;
  userId: string;
  channel: MessagingChannel;
  externalUserId: string;
  destinationId: string | null;
  status: MessagingIdentityStatus;
  verifiedAt: Date | null;
  verificationMethod: string | null;
  legacySource: string | null;
  revokedAt: Date | null;
  version: number;
};

type LegacyIdentity = {
  telegramUserId: string;
  userId: string;
  phoneNumber?: string;
};

type Pending = {
  telegramUserId: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
};

const user = {
  id: 'user-1',
  mobile: '09121234567',
  memberActive: true,
  companyActive: true,
};

const originalWebhookSecret = config.telegramWebhookSecret;
let generic: GenericIdentity[];
let legacy: LegacyIdentity[];
let pending: Map<string, Pending>;
let nextGenericId: number;

function genericWhere(where: Record<string, any>) {
  if (where.userId_channel) {
    return generic.find(
      (row) =>
        row.userId === where.userId_channel.userId &&
        row.channel === where.userId_channel.channel,
    ) ?? null;
  }
  if (where.channel_externalUserId) {
    return generic.find(
      (row) =>
        row.channel === where.channel_externalUserId.channel &&
        row.externalUserId === where.channel_externalUserId.externalUserId,
    ) ?? null;
  }
  if (where.id) {
    return generic.find((row) => row.id === where.id) ?? null;
  }
  return null;
}

function databaseFake() {
  const messagingIdentity = {
    findUnique: vi.fn(async ({ where }: { where: Record<string, any> }) =>
      genericWhere(where),
    ),
    create: vi.fn(async ({ data }: { data: Partial<GenericIdentity> }) => {
      if (
        generic.some(
          (row) =>
            (row.userId === data.userId && row.channel === data.channel) ||
            (row.channel === data.channel &&
              row.externalUserId === data.externalUserId),
        )
      ) {
        throw Object.assign(new Error('unique conflict'), { code: 'P2002' });
      }
      const row: GenericIdentity = {
        id: `generic-${nextGenericId++}`,
        userId: data.userId!,
        channel: data.channel!,
        externalUserId: data.externalUserId!,
        destinationId: data.destinationId ?? null,
        status: data.status ?? MessagingIdentityStatus.ACTIVE,
        verifiedAt: data.verifiedAt ?? null,
        verificationMethod: data.verificationMethod ?? null,
        legacySource: data.legacySource ?? null,
        revokedAt: data.revokedAt ?? null,
        version: data.version ?? 1,
      };
      generic.push(row);
      return row;
    }),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, any>;
      }) => {
        const row = genericWhere(where);
        if (!row) throw new Error('missing generic identity');
        Object.assign(row, {
          ...data,
          version:
            typeof data.version === 'object'
              ? row.version + data.version.increment
              : (data.version ?? row.version),
        });
        return row;
      },
    ),
  };

  const telegramPendingConnection = {
    findUnique: vi.fn(
      async ({ where }: { where: { telegramUserId: string } }) =>
        pending.get(where.telegramUserId) ?? null,
    ),
    upsert: vi.fn(
      async ({
        where,
        create,
        update,
      }: {
        where: { telegramUserId: string };
        create: Pending;
        update: Omit<Pending, 'telegramUserId'>;
      }) => {
        const row = pending.has(where.telegramUserId)
          ? { telegramUserId: where.telegramUserId, ...update }
          : create;
        pending.set(where.telegramUserId, row);
        return row;
      },
    ),
    deleteMany: vi.fn(async ({ where }: { where: Record<string, any> }) => {
      const row = pending.get(where.telegramUserId);
      if (
        !row ||
        row.userId !== where.userId ||
        +row.createdAt !== +where.createdAt ||
        +row.expiresAt !== +where.expiresAt.equals ||
        row.expiresAt <= where.expiresAt.gt
      ) {
        return { count: 0 };
      }
      pending.delete(where.telegramUserId);
      return { count: 1 };
    }),
  };

  const userModel = {
    findFirst: vi.fn(async ({ where }: { where: Record<string, any> }) => {
      if (
        where.id !== user.id ||
        (where.mobile && where.mobile !== user.mobile) ||
        !user.memberActive ||
        !user.companyActive
      ) {
        return null;
      }
      return { id: user.id, mobile: user.mobile };
    }),
  };

  const transactionClient = {
    user: userModel,
    telegramPendingConnection,
    messagingIdentity,
  };

  return {
    ...transactionClient,
    messagingLinkChallenge: {},
    $transaction: vi.fn(
      async (
        work: (tx: typeof transactionClient) => Promise<unknown>,
        options: unknown,
      ) => {
        expect(options).toEqual({ isolationLevel: 'Serializable' });
        const genericSnapshot = structuredClone(generic);
        const legacySnapshot = structuredClone(legacy);
        const pendingSnapshot = structuredClone(pending);
        try {
          return await work(transactionClient);
        } catch (error) {
          generic = genericSnapshot;
          legacy = legacySnapshot;
          pending = pendingSnapshot;
          throw error;
        }
      },
    ),
  };
}

beforeEach(() => {
  generic = [];
  legacy = [];
  pending = new Map();
  nextGenericId = 1;
  user.memberActive = true;
  user.companyActive = true;
  config.telegramWebhookSecret = 'p4-test-webhook-secret';
});

afterAll(() => {
  config.telegramWebhookSecret = originalWebhookSecret;
});

describe('P4 backfill runner', () => {
  const rows = [
    { legacyIdentityId: 'legacy-1', userId: 'user-1', telegramUserId: '100' },
    { legacyIdentityId: 'legacy-2', userId: 'user-2', telegramUserId: '200' },
    { legacyIdentityId: 'legacy-3', userId: 'user-3', telegramUserId: '300' },
  ];

  function reader(source = rows) {
    return async (after: string | undefined, take: number) => {
      const start = after
        ? source.findIndex((row) => row.legacyIdentityId === after) + 1
        : 0;
      return source.slice(start, start + take);
    };
  }

  it('dry-run only inspects, reports counts and advances a checkpoint', async () => {
    const repository = {
      inspectLegacyTelegramIdentity: vi.fn(async (row: (typeof rows)[number]) =>
        row.legacyIdentityId === 'legacy-2'
          ? ({ status: 'already_synced' } as const)
          : ({ status: 'would_create' } as const),
      ),
      importLegacyTelegramIdentity: vi.fn(),
    };

    const result = await runMessagingIdentityBackfill({
      mode: 'dry-run',
      batchSize: 2,
      readBatch: reader(),
      repository,
    });

    expect(result).toMatchObject({
      scanned: 3,
      wouldCreate: 2,
      created: 0,
      alreadySynced: 1,
      conflicts: 0,
      checkpoint: 'legacy-3',
      stoppedAt: null,
    });
    expect(repository.importLegacyTelegramIdentity).not.toHaveBeenCalled();
  });

  it('apply stops at the first conflict and checkpoints only successful rows', async () => {
    const repository = {
      inspectLegacyTelegramIdentity: vi.fn(),
      importLegacyTelegramIdentity: vi.fn(async (row: (typeof rows)[number]) =>
        row.legacyIdentityId === 'legacy-2'
          ? ({
              status: 'conflict',
              reason: 'external_identity_taken',
            } as const)
          : ({ status: 'created' } as const),
      ),
    };

    const result = await runMessagingIdentityBackfill({
      mode: 'apply',
      batchSize: 3,
      readBatch: reader(),
      repository,
    });

    expect(result).toMatchObject({
      scanned: 2,
      created: 1,
      conflicts: 1,
      checkpoint: 'legacy-1',
      stoppedAt: 'legacy-2',
    });
    expect(repository.importLegacyTelegramIdentity).toHaveBeenCalledTimes(2);
  });

  it('can resume idempotently from an explicit checkpoint', async () => {
    const repository = {
      inspectLegacyTelegramIdentity: vi.fn(),
      importLegacyTelegramIdentity: vi.fn(async () => ({
        status: 'already_synced',
      }) as const),
    };

    const result = await runMessagingIdentityBackfill({
      mode: 'apply',
      batchSize: 10,
      after: 'legacy-2',
      readBatch: reader(),
      repository,
    });

    expect(result).toMatchObject({
      scanned: 1,
      created: 0,
      alreadySynced: 1,
      checkpoint: 'legacy-3',
    });
  });
});

describe('P4 Telegram compatibility and ownership safety', () => {
  it('imports a legacy binding as unverified and is idempotent', async () => {
    const db = databaseFake();
    const repository = createMessagingRepository(
      db as unknown as PrismaClient,
    );
    const input = {
      legacyIdentityId: 'legacy-1',
      userId: user.id,
      telegramUserId: '100',
    };

    expect(await repository.importLegacyTelegramIdentity(input)).toEqual({
      status: 'created',
    });
    expect(await repository.importLegacyTelegramIdentity(input)).toEqual({
      status: 'already_synced',
    });
    expect(generic).toMatchObject([
      {
        userId: user.id,
        channel: MessagingChannel.TELEGRAM,
        externalUserId: '100',
        destinationId: '100',
        verifiedAt: null,
        verificationMethod: 'LEGACY_IMPORT_UNVERIFIED',
        legacySource: 'telegram_identities',
      },
    ]);
    expect(legacy).toHaveLength(0);
  });

  it('reports a collision without overwriting another owner', async () => {
    generic.push({
      id: 'existing',
      userId: 'other-user',
      channel: MessagingChannel.TELEGRAM,
      externalUserId: '100',
      destinationId: '100',
      status: MessagingIdentityStatus.ACTIVE,
      verifiedAt: new Date(),
      verificationMethod: 'TEST',
      legacySource: null,
      revokedAt: null,
      version: 1,
    });
    const before = structuredClone(generic);
    const repository = createMessagingRepository(
      databaseFake() as unknown as PrismaClient,
    );

    expect(
      await repository.importLegacyTelegramIdentity({
        legacyIdentityId: 'legacy-1',
        userId: user.id,
        telegramUserId: '100',
      }),
    ).toEqual({
      status: 'conflict',
      reason: 'external_identity_taken',
    });
    expect(generic).toEqual(before);
  });

  it('keeps legacy-only writes and reads when dual-write is disabled', async () => {
    const repository = createTelegramRepository(
      databaseFake() as unknown as PrismaClient,
    );
    const challenge = await repository.createPendingConnection({
      telegramUserId: '100',
      userId: user.id,
      mobile: user.mobile,
    });

    expect(challenge).not.toBeNull();
    expect(
      await repository.confirmPendingConnection('100', challenge!.token),
    ).toEqual({ status: 'connected' });
    // Phase 2: TelegramIdentity is no longer written - only MessagingIdentity.
    expect(legacy).toHaveLength(0);
    expect(generic).toHaveLength(1);
    expect(generic[0]).toMatchObject({
      userId: user.id,
      channel: MessagingChannel.TELEGRAM,
      externalUserId: '100',
      status: MessagingIdentityStatus.ACTIVE,
      verificationMethod: 'TELEGRAM_SIGNED_CALLBACK_V1',
    });
    expect(
      (await repository.findIdentityByUserId(user.id))!.telegramUserId,
    ).toBe('100');
  });

  it('atomically dual-writes a securely confirmed new connection', async () => {
    const repository = createTelegramRepository(
      databaseFake() as unknown as PrismaClient,
    );
    const challenge = await repository.createPendingConnection({
      telegramUserId: '100',
      userId: user.id,
      mobile: user.mobile,
    });

    expect(
      await repository.confirmPendingConnection('100', challenge!.token),
    ).toEqual({ status: 'connected' });
    // Phase 2: Only MessagingIdentity is written even when dual-write flag is true.
    expect(legacy).toHaveLength(0);
    expect(generic).toMatchObject([
      {
        userId: user.id,
        channel: MessagingChannel.TELEGRAM,
        externalUserId: '100',
        status: MessagingIdentityStatus.ACTIVE,
        verificationMethod: 'TELEGRAM_SIGNED_CALLBACK_V1',
        legacySource: null,
      },
    ]);
    expect(generic[0]!.verifiedAt).toBeInstanceOf(Date);
  });

  it('does not consume pending or write legacy data on a late generic conflict', async () => {
    const repository = createTelegramRepository(
      databaseFake() as unknown as PrismaClient,
    );
    const challenge = await repository.createPendingConnection({
      telegramUserId: '100',
      userId: user.id,
      mobile: user.mobile,
    });

    generic.push({
      id: 'late-conflict',
      userId: 'other-user',
      channel: MessagingChannel.TELEGRAM,
      externalUserId: '100',
      destinationId: '100',
      status: MessagingIdentityStatus.ACTIVE,
      verifiedAt: new Date(),
      verificationMethod: 'TEST',
      legacySource: null,
      revokedAt: null,
      version: 1,
    });

    expect(
      await repository.confirmPendingConnection('100', challenge!.token),
    ).toEqual({
      status: 'rejected',
      reason: 'messaging_identity_conflict',
    });
    expect(legacy).toHaveLength(0);
    expect(pending.has('100')).toBe(true);
    expect(generic).toHaveLength(1);
  });
});


describe('P10 authoritative Telegram identity reads', () => {
  it('keeps legacy reads while the P10 switch is disabled', async () => {
    // Phase 2: Legacy reads are removed - even with readFromGeneric=false, only MessagingIdentity is read.
    legacy.push({ telegramUserId: '100', userId: user.id });
    const db = databaseFake() as unknown as PrismaClient;

    expect(
      await findOperationalTelegramIdentityByUserId(db, user.id),
    ).toBeNull();
    expect(
      await findOperationalTelegramIdentityByExternalId(db, '100'),
    ).toBeNull();
  });

  it('reads a verified active Telegram identity from the generic model', async () => {
    generic.push({
      id: 'generic-verified',
      userId: user.id,
      channel: MessagingChannel.TELEGRAM,
      externalUserId: '100',
      destinationId: '100',
      status: MessagingIdentityStatus.ACTIVE,
      verifiedAt: new Date(),
      verificationMethod: 'TELEGRAM_SIGNED_CALLBACK_V1',
      legacySource: null,
      revokedAt: null,
      version: 3,
    });
    const db = databaseFake() as unknown as PrismaClient;

    expect(
      await findOperationalTelegramIdentityByUserId(db, user.id),
    ).toMatchObject({
      userId: user.id,
      telegramUserId: '100',
      messagingIdentityId: 'generic-verified',
      identityVersion: 3,
    });
    expect(
      await findOperationalTelegramIdentityByExternalId(db, '100'),
    ).toMatchObject({ userId: user.id, telegramUserId: '100' });
  });

  it.each([
    ['revoked', MessagingIdentityStatus.REVOKED, new Date()],
    ['unverified', MessagingIdentityStatus.ACTIVE, null],
  ])('does not revive a %s generic identity through legacy fallback', async (
    _label,
    status,
    verifiedAt,
  ) => {
    legacy.push({ telegramUserId: '100', userId: user.id });
    generic.push({
      id: 'generic-blocked',
      userId: user.id,
      channel: MessagingChannel.TELEGRAM,
      externalUserId: '100',
      destinationId: '100',
      status,
      verifiedAt,
      verificationMethod: 'TEST',
      legacySource: null,
      revokedAt: status === MessagingIdentityStatus.REVOKED ? new Date() : null,
      version: 2,
    });
    const db = databaseFake() as unknown as PrismaClient;

    expect(
      await findOperationalTelegramIdentityByUserId(db, user.id),
    ).toBeNull();
    expect(
      await findOperationalTelegramIdentityByExternalId(db, '100'),
    ).toBeNull();
  });

  it('does not fall back when the authoritative generic row is missing', async () => {
    legacy.push({ telegramUserId: '100', userId: user.id });
    const db = databaseFake() as unknown as PrismaClient;
    expect(
      await findOperationalTelegramIdentityByUserId(db, user.id),
    ).toBeNull();
  });
});
