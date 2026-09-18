import Fastify from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../src/config.js';
import { createTelegramRepository } from '../src/modules/telegram/telegram-repository.js';
import { telegramRoutes } from '../src/modules/telegram/telegram-routes.js';

const mocks = vi.hoisted(() => ({
  db: {} as Record<string, unknown>,
  sendMessage: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({ prisma: mocks.db }));
vi.mock('../src/modules/telegram/telegram-client.js', () => ({
  createTelegramClient: () => ({ sendMessage: mocks.sendMessage }),
}));

type Pending = {
  telegramUserId: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
};
type Identity = {
  telegramUserId: string;
  userId: string;
  phoneNumber?: string;
};
type TestUser = {
  id: string;
  mobile: string;
  memberActive: boolean;
  companyActive: boolean;
};
type GenericIdentity = {
  id: string;
  userId: string;
  channel: string;
  externalUserId: string;
  destinationId: string | null;
  status: string;
  verifiedAt: Date | null;
  verificationMethod: string | null;
  legacySource: string | null;
  version: number;
};

let users: TestUser[];
let pending: Map<string, Pending>;
let identities: Identity[];
let messagingIdentities: GenericIdentity[];
let failIdentityCreate: boolean;
let serializationConflicts: number;
let transactionCalls: number;
let app: ReturnType<typeof Fastify>;
let repository: ReturnType<typeof createTelegramRepository>;

const originalSecret = config.telegramWebhookSecret;
const webhookSecret = 'test-only-telegram-linking-secret';
const mobile = '09123456789';

function databaseFake() {
  const user = {
    findUnique: vi.fn(async ({ where }: { where: { mobile: string } }) =>
      users.find((item) => item.mobile === where.mobile) ?? null,
    ),
    findFirst: vi.fn(
      async ({
        where,
      }: {
        where: { id: string; mobile?: string; memberships: unknown };
      }) => {
        expect(where.memberships).toEqual({
          some: { isActive: true, company: { isActive: true } },
        });
        return (
          users.find(
            (item) =>
              item.id === where.id &&
              (!where.mobile || item.mobile === where.mobile) &&
              item.memberActive &&
              item.companyActive,
          ) ?? null
        );
      },
    ),
  };

  const telegramIdentity = {
    findUnique: vi.fn(
      async ({ where }: { where: Partial<Identity> }) =>
        identities.find((identity) =>
          Object.entries(where).every(
            ([key, value]) =>
              identity[key as keyof Identity] === value,
          ),
        ) ?? null,
    ),
    findFirst: vi.fn(
      async ({ where }: { where: { OR: Partial<Identity>[] } }) =>
        identities.find((identity) =>
          where.OR.some((entry) =>
            Object.entries(entry).every(
              ([key, value]) =>
                identity[key as keyof Identity] === value,
            ),
          ),
        ) ?? null,
    ),
    create: vi.fn(async ({ data }: { data: Identity }) => {
      if (failIdentityCreate) {
        throw Object.assign(new Error('unique conflict'), { code: 'P2002' });
      }
      identities.push(data);
      return data;
    }),
  };

  const messagingIdentity = {
    findUnique: vi.fn(
      async ({ where }: { where: Record<string, unknown> }) => {
        if (where.userId_channel) {
          const key = where.userId_channel as { userId: string; channel: string };
          return (
            messagingIdentities.find(
              (i) => i.userId === key.userId && i.channel === key.channel,
            ) ?? null
          );
        }
        if (where.channel_externalUserId) {
          const key = where.channel_externalUserId as { channel: string; externalUserId: string };
          return (
            messagingIdentities.find(
              (i) => i.channel === key.channel && i.externalUserId === key.externalUserId,
            ) ?? null
          );
        }
        if (where.id) {
          return messagingIdentities.find((i) => i.id === where.id) ?? null;
        }
        return null;
      },
    ),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      if (failIdentityCreate) {
        throw Object.assign(new Error('unique conflict'), { code: 'P2002' });
      }
      // enforce unique constraints for test realism
      const existsByUser = messagingIdentities.find(
        (i) => i.userId === data.userId && i.channel === data.channel,
      );
      const existsByExternal = messagingIdentities.find(
        (i) => i.channel === data.channel && i.externalUserId === data.externalUserId,
      );
      if (existsByUser || existsByExternal) {
        throw Object.assign(new Error('unique conflict'), { code: 'P2002' });
      }
      const id = (data.id as string) ?? `mid_${messagingIdentities.length + 1}_${Date.now()}`;
      const record: GenericIdentity = {
        id,
        userId: data.userId as string,
        channel: data.channel as string,
        externalUserId: data.externalUserId as string,
        destinationId: (data.destinationId as string | null) ?? (data.externalUserId as string),
        status: (data.status as string) ?? 'ACTIVE',
        verifiedAt: (data.verifiedAt as Date | null) ?? null,
        verificationMethod: (data.verificationMethod as string | null) ?? null,
        legacySource: (data.legacySource as string | null) ?? null,
        version: (data.version as number) ?? 1,
      };
      messagingIdentities.push(record);
      return record;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const rec = messagingIdentities.find((i) => i.id === where.id);
      if (!rec) throw new Error('messaging identity not found');
      if (data.destinationId !== undefined) rec.destinationId = data.destinationId as string | null;
      if (data.status !== undefined) rec.status = data.status as string;
      if (data.verifiedAt !== undefined) rec.verifiedAt = data.verifiedAt as Date | null;
      if (data.verificationMethod !== undefined) rec.verificationMethod = data.verificationMethod as string | null;
      if (data.legacySource !== undefined) rec.legacySource = data.legacySource as string | null;
      if (data.revokedAt !== undefined) (rec as unknown as Record<string, unknown>).revokedAt = data.revokedAt;
      if ((data.version as { increment?: number })?.increment) {
        rec.version += (data.version as { increment: number }).increment;
      }
      return rec;
    }),
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
    deleteMany: vi.fn(
      async ({
        where,
      }: {
        where: {
          telegramUserId: string;
          userId: string;
          createdAt: Date;
          expiresAt: { equals: Date; gt: Date };
        };
      }) => {
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
      },
    ),
  };

  const transactionClient = {
    user,
    telegramIdentity,
    messagingIdentity,
    telegramPendingConnection,
  };

  return {
    ...transactionClient,
    $transaction: vi.fn(
      async (
        work: (client: typeof transactionClient) => Promise<unknown>,
        options: unknown,
      ) => {
        transactionCalls += 1;
        expect(options).toEqual({ isolationLevel: 'Serializable' });

        if (serializationConflicts-- > 0) {
          throw Object.assign(new Error('serialization conflict'), {
            code: 'P2034',
          });
        }

        const pendingSnapshot = new Map(pending);
        const identitySnapshot = [...identities];
        const genericSnapshot = [...messagingIdentities];
        try {
          return await work(transactionClient);
        } catch (error) {
          pending = pendingSnapshot;
          identities = identitySnapshot;
          messagingIdentities = genericSnapshot;
          throw error;
        }
      },
    ),
  };
}

beforeEach(async () => {
  config.telegramWebhookSecret = webhookSecret;
  users = [
    {
      id: 'user-1',
      mobile,
      memberActive: true,
      companyActive: true,
    },
  ];
  pending = new Map();
  identities = [];
  messagingIdentities = [];
  failIdentityCreate = false;
  serializationConflicts = 0;
  transactionCalls = 0;
  mocks.sendMessage.mockReset().mockResolvedValue({ ok: true });

  Object.assign(mocks.db, databaseFake());
  repository = createTelegramRepository(
    mocks.db as unknown as PrismaClient,
  );

  app = Fastify();
  await app.register(telegramRoutes, { prefix: '/api/v1' });
  await app.ready();
});

afterEach(async () => {
  config.telegramWebhookSecret = originalSecret;
  vi.useRealTimers();
  await app.close();
});

function contactUpdate(contactUserId: number | undefined = 100, type = 'private') {
  return {
    message: {
      from: { id: 100 },
      chat: { id: 100, type },
      contact: {
        user_id: contactUserId,
        phone_number: '+989123456789',
      },
    },
  };
}

function callbackUpdate(data: string, id = 100, type = 'private') {
  return {
    callback_query: {
      from: { id },
      data,
      message: { chat: { id, type } },
    },
  };
}

async function post(
  payload: unknown,
  suppliedSecret: string | null = webhookSecret,
) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/telegram/webhook',
    payload,
    headers:
      suppliedSecret === null
        ? {}
        : { 'x-telegram-bot-api-secret-token': suppliedSecret },
  });
  return { code: response.statusCode, body: response.json() };
}

async function beginLinking() {
  const response = await post(contactUpdate());
  expect(response.body.status).toBe('pending_confirmation');
  const markup = mocks.sendMessage.mock.calls.at(-1)![2];
  return markup.inline_keyboard[0][0].callback_data as string;
}

describe('Telegram linking perimeter and ownership', () => {
  it('links an eligible owner and consumes the pending once', async () => {
    const callbackData = await beginLinking();
    expect(Buffer.byteLength(callbackData)).toBeLessThanOrEqual(64);

    expect(
      (await post(callbackUpdate(callbackData))).body.status,
    ).toBe('connected');
    expect(identities).toEqual([
      {
        telegramUserId: '100',
        userId: 'user-1',
        phoneNumber: mobile,
      },
    ]);
    // MessagingIdentity is now primary - must also be created as ACTIVE verified
    expect(messagingIdentities).toHaveLength(1);
    expect(messagingIdentities[0]).toMatchObject({
      userId: 'user-1',
      channel: 'TELEGRAM',
      externalUserId: '100',
      destinationId: '100',
      status: 'ACTIVE',
      verificationMethod: 'TELEGRAM_SIGNED_CALLBACK_V1',
    });
    expect(messagingIdentities[0]!.verifiedAt).toBeInstanceOf(Date);
    expect(pending.size).toBe(0);

    mocks.sendMessage.mockClear();
    expect(
      (await post(callbackUpdate(callbackData))).body.status,
    ).toBe('rejected');
    expect(mocks.sendMessage).not.toHaveBeenCalled();
  });

  it.each([null, 'wrong-secret'])(
    'rejects a missing or incorrect webhook secret: %s',
    async (value) => {
      expect((await post(contactUpdate(), value)).code).toBe(403);
      expect(transactionCalls).toBe(0);
      expect(mocks.sendMessage).not.toHaveBeenCalled();
    },
  );

  it('disables only new linking when the secret is absent', async () => {
    config.telegramWebhookSecret = '';
    expect((await post(contactUpdate())).code).toBe(503);
    expect(
      await repository.createPendingConnection({
        telegramUserId: '100',
        userId: 'user-1',
        mobile,
      }),
    ).toBeNull();
    expect(transactionCalls).toBe(0);
  });

  it('does not expose the former public confirmation endpoint', async () => {
    await beginLinking();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/telegram/confirm',
      payload: { telegramUserId: 100, phoneNumber: mobile },
    });
    expect(response.statusCode).toBe(404);
    expect(identities).toHaveLength(0);
  });

  it('rejects another person or missing contact owner', async () => {
    expect(
      (await post(contactUpdate(200))).body.reason,
    ).toBe('contact_owner_mismatch');
    // Missing user_id should also be rejected (no default)
    expect(
      (
        await post({
          message: {
            from: { id: 100 },
            chat: { id: 100, type: 'private' },
            contact: { phone_number: '+989123456789' },
          },
        })
      ).body.reason,
    ).toBe('contact_owner_mismatch');
    expect(pending.size).toBe(0);
  });

  it.each(['group', 'supergroup', 'channel'])(
    'rejects %s messages and callbacks',
    async (type) => {
      expect(
        (await post(contactUpdate(100, type))).body.reason,
      ).toBe('private_chat_required');
      expect(
        (
          await post(
            callbackUpdate(
              'telegram_confirm:' + '0'.repeat(32),
              100,
              type,
            ),
          )
        ).body.reason,
      ).toBe('private_chat_required');
      expect(transactionCalls).toBe(0);
    },
  );

  it('requires a private chat owned by the sender', async () => {
    const update = contactUpdate();
    update.message.chat.id = 200;
    expect((await post(update)).body.reason).toBe('private_chat_required');
  });

  it('rejects malformed phone and sender values', async () => {
    const invalidPhone = contactUpdate();
    invalidPhone.message.contact.phone_number = 'not-a-phone';
    expect(
      (await post(invalidPhone)).body.reason,
    ).toBe('invalid_phone_number');

    const unsafeSender = contactUpdate();
    unsafeSender.message.from.id = Number.MAX_SAFE_INTEGER + 1;
    expect(
      (await post(unsafeSender)).body.reason,
    ).toBe('private_chat_required');
    expect(transactionCalls).toBe(0);
  });

  it('requests contact on start without writing pending state', async () => {
    const response = await post({
      message: {
        from: { id: 100 },
        chat: { id: 100, type: 'private' },
        text: '/start',
      },
    });
    expect(response.body.action).toBe('request_contact');
    expect(pending.size).toBe(0);
  });
});

describe('Telegram challenge eligibility and lifecycle', () => {
  it.each(['memberActive', 'companyActive'] as const)(
    'rejects inactive %s before creating pending state',
    async (field) => {
      users[0]![field] = false;
      expect((await post(contactUpdate())).body.status).toBe('rejected');
      expect(pending.size).toBe(0);
    },
  );

  it.each(['memberActive', 'companyActive'] as const)(
    'rechecks %s during confirmation',
    async (field) => {
      const callbackData = await beginLinking();
      users[0]![field] = false;
      mocks.sendMessage.mockClear();

      expect(
        (await post(callbackUpdate(callbackData))).body.reason,
      ).toBe('user_not_eligible');
      expect(identities).toHaveLength(0);
      expect(messagingIdentities).toHaveLength(0);
      expect(mocks.sendMessage).not.toHaveBeenCalled();

      users[0]![field] = true;
      expect(
        (await post(callbackUpdate(callbackData))).body.status,
      ).toBe('connected');
    },
  );

  it('rejects unknown users without exposing a user id', async () => {
    users = [];
    const response = await post(contactUpdate());
    expect(response.body.reason).toBe('connection_not_allowed');
    expect(response.body.userId).toBeUndefined();
    expect(pending.size).toBe(0);
  });

  it('rejects static, malformed and tampered callbacks', async () => {
    await beginLinking();
    for (const data of [
      'telegram_confirm',
      'telegram_confirm:bad',
      'telegram_confirm:' + '0'.repeat(32),
    ]) {
      expect(
        (await post(callbackUpdate(data))).body.status,
      ).toBe('rejected');
    }
    expect(identities).toHaveLength(0);
  });

  it('binds the proof to the Telegram sender', async () => {
    const callbackData = await beginLinking();
    expect(
      (await post(callbackUpdate(callbackData, 200))).body.status,
    ).toBe('rejected');
    expect(identities).toHaveLength(0);
  });

  it('invalidates an earlier button when pending is renewed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const first = await beginLinking();
    const second = await beginLinking();
    expect(second).not.toBe(first);

    expect(
      (await post(callbackUpdate(first))).body.reason,
    ).toBe('invalid_confirmation');
    expect(
      (await post(callbackUpdate(second))).body.status,
    ).toBe('connected');
  });

  it('rejects expiry at exactly ten minutes', async () => {
    const callbackData = await beginLinking();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(pending.get('100')!.expiresAt);

    expect(
      (await post(callbackUpdate(callbackData))).body.status,
    ).toBe('rejected');
    expect(identities).toHaveLength(0);
  });

  it('invalidates pending after the Followa mobile changes', async () => {
    const callbackData = await beginLinking();
    users[0]!.mobile = '09999999999';

    expect(
      (await post(callbackUpdate(callbackData))).body.reason,
    ).toBe('invalid_confirmation');
    expect(identities).toHaveLength(0);
  });

  it('invalidates pending after webhook-secret rotation', async () => {
    const callbackData = await beginLinking();
    config.telegramWebhookSecret = 'rotated-test-secret';

    expect(
      (
        await post(
          callbackUpdate(callbackData),
          config.telegramWebhookSecret,
        )
      ).body.reason,
    ).toBe('invalid_confirmation');
  });

  it.each([
    { telegramUserId: '100', userId: 'another-user' },
    { telegramUserId: '200', userId: 'user-1' },
  ])('never reassigns an existing identity: %j', async (identity) => {
    const callbackData = await beginLinking();
    identities.push(identity);
    // Also mirror into generic for primary check
    messagingIdentities.push({
      id: `mid_${identity.telegramUserId}`,
      userId: identity.userId,
      channel: 'TELEGRAM',
      externalUserId: identity.telegramUserId,
      destinationId: identity.telegramUserId,
      status: 'ACTIVE',
      verifiedAt: new Date(),
      verificationMethod: 'TELEGRAM_SIGNED_CALLBACK_V1',
      legacySource: null,
      version: 1,
    });
    mocks.sendMessage.mockClear();

    expect(
      (await post(callbackUpdate(callbackData))).body.reason,
    ).toBe('identity_already_linked');
    expect(identities).toEqual([identity]);
    expect(mocks.sendMessage).not.toHaveBeenCalled();
  });

  it('does not transfer an old manager identity to a replacement', async () => {
    const callbackData = await beginLinking();
    users[0]!.memberActive = false;
    users[0]!.mobile = '09999999999';
    users.push({
      id: 'new-manager',
      mobile,
      memberActive: true,
      companyActive: true,
    });

    expect(
      (await post(callbackUpdate(callbackData))).body.status,
    ).toBe('rejected');

    identities.push({ telegramUserId: '100', userId: 'user-1' });
    messagingIdentities.push({
      id: 'mid_100',
      userId: 'user-1',
      channel: 'TELEGRAM',
      externalUserId: '100',
      destinationId: '100',
      status: 'ACTIVE',
      verifiedAt: new Date(),
      verificationMethod: 'TELEGRAM_SIGNED_CALLBACK_V1',
      legacySource: null,
      version: 1,
    });
    expect((await post(contactUpdate())).body.status).toBe('rejected');
    expect(identities[0]!.userId).toBe('user-1');
  });

  it('rolls back pending consumption if identity insertion fails', async () => {
    const callbackData = await beginLinking();
    failIdentityCreate = true;

    expect(
      (await post(callbackUpdate(callbackData))).body.reason,
    ).toBe('identity_already_linked');
    expect(pending.has('100')).toBe(true);
    expect(identities).toHaveLength(0);
    expect(messagingIdentities).toHaveLength(0);
  });

  it('retries serializable conflicts up to success', async () => {
    serializationConflicts = 2;
    await beginLinking();
    expect(transactionCalls).toBe(3);
  });

  it('preserves existing identity reads when linking is disabled', async () => {
    // Generic is now primary - push generic identity
    messagingIdentities.push({
      id: 'mid_generic_100',
      userId: 'user-1',
      channel: 'TELEGRAM',
      externalUserId: '100',
      destinationId: '100',
      status: 'ACTIVE',
      verifiedAt: new Date(),
      verificationMethod: 'TELEGRAM_SIGNED_CALLBACK_V1',
      legacySource: null,
      version: 1,
    });
    identities.push({ telegramUserId: '100', userId: 'user-1' });
    config.telegramWebhookSecret = '';

    expect((await repository.findUserByMobile(mobile))!.id).toBe('user-1');
    expect(
      (await repository.findIdentityByUserId('user-1'))!.telegramUserId,
    ).toBe('100');
  });
});

describe('Telegram linking — MessagingIdentity primary', () => {
  it('new Telegram link creates MessagingIdentity with verifiedAt', async () => {
    const callbackData = await beginLinking();
    expect(messagingIdentities).toHaveLength(0);
    expect((await post(callbackUpdate(callbackData))).body.status).toBe('connected');
    expect(messagingIdentities).toHaveLength(1);
    const created = messagingIdentities[0]!;
    expect(created).toMatchObject({
      userId: 'user-1',
      channel: 'TELEGRAM',
      externalUserId: '100',
      destinationId: '100',
      status: 'ACTIVE',
      verificationMethod: 'TELEGRAM_SIGNED_CALLBACK_V1',
    });
    expect(created.verifiedAt).toBeInstanceOf(Date);
    expect(created.version).toBe(1);
    // Legacy still written for backward compat
    expect(identities).toHaveLength(1);
  });

  it('OTP resolver can find newly linked Telegram identity via generic read', async () => {
    const callbackData = await beginLinking();
    await post(callbackUpdate(callbackData));
    const byUser = await repository.findIdentityByUserId('user-1');
    const byTelegram = await repository.findIdentityByTelegramUserId('100');
    expect(byUser).toMatchObject({ telegramUserId: '100', userId: 'user-1' });
    expect(byTelegram).toMatchObject({ telegramUserId: '100', userId: 'user-1' });
    // MessagingIdentity is the source - ensures destination lookup works
    expect(messagingIdentities[0]!.verifiedAt).not.toBeNull();
    // Generic read includes provenance fields
    expect(byUser).toHaveProperty('messagingIdentityId');
  });

  it('duplicate Telegram external id rejected for second user', async () => {
    // First user links 100
    const first = await beginLinking();
    await post(callbackUpdate(first));
    expect(messagingIdentities).toHaveLength(1);

    // Second user with different mobile tries to link same telegram id
    users.push({
      id: 'user-2',
      mobile: '09123456780',
      memberActive: true,
      companyActive: true,
    });
    // Directly test repository guard: createPendingConnection with same telegramUserId but user-2
    const secondAttempt = await repository.createPendingConnection({
      telegramUserId: '100',
      userId: 'user-2',
      mobile: '09123456780',
    });
    expect(secondAttempt).toBeNull();
    expect(messagingIdentities).toHaveLength(1);
    expect(pending.size).toBe(0);

    // Via webhook, existing identity blocks new pending creation
    const response = await post(contactUpdate());
    expect(response.body.status).toBe('rejected');
    // createPendingConnection returns null for existing identity -> handleContact maps to connection_not_allowed
    expect(response.body.reason).toBe('connection_not_allowed');
  });
});
