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

let users: TestUser[];
let pending: Map<string, Pending>;
let identities: Identity[];
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
        try {
          return await work(transactionClient);
        } catch (error) {
          pending = pendingSnapshot;
          identities = identitySnapshot;
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
    expect(
      (await post(contactUpdate(undefined))).body.reason,
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
  });

  it('retries serializable conflicts up to success', async () => {
    serializationConflicts = 2;
    await beginLinking();
    expect(transactionCalls).toBe(3);
  });

  it('preserves existing identity reads when linking is disabled', async () => {
    identities.push({ telegramUserId: '100', userId: 'user-1' });
    config.telegramWebhookSecret = '';

    expect((await repository.findUserByMobile(mobile))!.id).toBe('user-1');
    expect(
      (await repository.findIdentityByUserId('user-1'))!.telegramUserId,
    ).toBe('100');
  });
});
