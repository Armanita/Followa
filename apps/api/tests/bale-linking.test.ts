import { MessagingChannel } from '@prisma/client';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { config } from '../src/config.js';
import { prisma } from '../src/lib/prisma.js';
import { createBaleClient } from '../src/modules/bale/bale-client.js';
import { createMessagingLinkService } from '../src/modules/messaging/messaging-link-service.js';
import { createMessagingRepository } from '../src/modules/messaging/messaging-repository.js';
import { BaleProvider } from '../src/modules/messaging/providers/bale-provider.js';
import type {
  MessagingProvider,
  MessagingSendRequest,
} from '../src/modules/messaging/messaging-types.js';
import {
  closeTestApp,
  getTestApp,
  seedFixture,
} from './helpers.js';

let fixture: Awaited<ReturnType<typeof seedFixture>>;
let app: Awaited<ReturnType<typeof getTestApp>>;
let managerMobile: string;
let repository: ReturnType<typeof createMessagingRepository>;
let provider: MessagingProvider & {
  send: ReturnType<typeof vi.fn>;
};

const originalConfig = {
  baleBotToken: config.baleBotToken,
  baleWebhookSecret: config.baleWebhookSecret,
  baleLinkingEnabled: config.baleLinkingEnabled,
};
const webhookSecret = 'p5-test-webhook-secret-0123456789abcdef';
let counter = 0;

function baleUserId(): string {
  counter += 1;
  return String(2_000_000_000 + counter);
}

function callbackToken(): string {
  const request = provider.send.mock.calls.find(
    ([item]: [MessagingSendRequest]) =>
      item.metadata && 'replyMarkup' in item.metadata,
  )?.[0] as MessagingSendRequest | undefined;
  const markup = request?.metadata?.replyMarkup as {
    inline_keyboard: Array<Array<{ callback_data: string }>>;
  };
  const callbackData = markup.inline_keyboard[0]![0]!.callback_data;
  expect(Buffer.byteLength(callbackData)).toBeLessThanOrEqual(64);
  return callbackData.replace('bale_confirm:', '');
}

beforeAll(async () => {
  app = await getTestApp();
  fixture = await seedFixture(1);
  managerMobile = (
    await prisma.user.findUniqueOrThrow({
      where: { id: fixture.manager.id },
      select: { mobile: true },
    })
  ).mobile;
  repository = createMessagingRepository(prisma);
});

beforeEach(async () => {
  await prisma.messagingLinkChallenge.deleteMany({
    where: {
      channel: MessagingChannel.BALE,
      userId: {
        in: [fixture.manager.id, fixture.employees[0]!.id],
      },
    },
  });
  await prisma.messagingIdentity.deleteMany({
    where: {
      channel: MessagingChannel.BALE,
      userId: {
        in: [fixture.manager.id, fixture.employees[0]!.id],
      },
    },
  });
  await prisma.company.update({
    where: { id: fixture.company.id },
    data: { isActive: true },
  });
  await prisma.companyMembership.updateMany({
    where: { companyId: fixture.company.id },
    data: { isActive: true },
  });

  provider = {
    name: 'bale',
    send: vi.fn(async (_request: MessagingSendRequest) => undefined),
  };
  config.baleBotToken = 'p5-test-token';
  config.baleWebhookSecret = webhookSecret;
  config.baleLinkingEnabled = true;
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  config.baleBotToken = originalConfig.baleBotToken;
  config.baleWebhookSecret = originalConfig.baleWebhookSecret;
  config.baleLinkingEnabled = originalConfig.baleLinkingEnabled;
  await fixture?.cleanup();
  await closeTestApp();
});

describe('Bale client and provider boundary', () => {
  it('uses the official Bale endpoint and preserves message markup', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true, result: {} }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    const markup = {
      inline_keyboard: [
        [{ text: 'تایید', callback_data: 'confirm:token' }],
      ],
    };

    await createBaleClient().sendMessage('123456', 'متن آزمایشی', markup);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe(
      'https://tapi.bale.ai/botp5-test-token/sendMessage',
    );
    expect(JSON.parse(String(options?.body))).toEqual({
      chat_id: '123456',
      text: 'متن آزمایشی',
      reply_markup: markup,
    });
    fetchMock.mockRestore();
  });

  it('maps the common provider contract without changing destination', async () => {
    const sendMessage = vi.fn(async () => undefined);
    const bale = new BaleProvider({ sendMessage });
    const request = {
      destination: '987654',
      text: 'پیام',
      metadata: {
        replyMarkup: { remove_keyboard: true },
      },
    };

    await bale.send(request);

    expect(sendMessage).toHaveBeenCalledWith(
      '987654',
      'پیام',
      { remove_keyboard: true },
    );
  });
});

describe('secure Bale identity linking', () => {
  it('stores only a one-time hash and links the same private Bale user', async () => {
    const id = baleUserId();
    const service = createMessagingLinkService(repository, provider);

    expect(
      await service.beginBaleLink({
        baleUserId: id,
        contactUserId: id,
        phoneNumber: managerMobile,
      }),
    ).toMatchObject({ status: 'pending_confirmation' });

    const rawToken = callbackToken();
    const challenge = await prisma.messagingLinkChallenge.findFirstOrThrow({
      where: {
        channel: MessagingChannel.BALE,
        externalUserId: id,
      },
    });
    expect(challenge.tokenHash).not.toBe(rawToken);
    expect(challenge.tokenHash).toHaveLength(64);

    expect(await service.confirmBaleLink(id, rawToken)).toEqual({
      status: 'connected',
    });
    expect(
      await repository.findIdentityByExternalId(
        MessagingChannel.BALE,
        id,
      ),
    ).toMatchObject({
      userId: fixture.manager.id,
      destinationId: id,
      verifiedAt: expect.any(Date),
      verificationMethod: 'BALE_CONTACT_CALLBACK_V1',
    });
    expect(await service.confirmBaleLink(id, rawToken)).toMatchObject({
      status: 'rejected',
      reason: 'invalid_confirmation',
    });
  });

  it('rejects another contact owner before reading or writing identity state', async () => {
    const service = createMessagingLinkService(repository, provider);
    expect(
      await service.beginBaleLink({
        baleUserId: baleUserId(),
        contactUserId: baleUserId(),
        phoneNumber: managerMobile,
      }),
    ).toEqual({
      status: 'rejected',
      reason: 'contact_owner_mismatch',
    });
    expect(provider.send).not.toHaveBeenCalled();
  });

  it('rechecks company state during confirmation', async () => {
    const id = baleUserId();
    const service = createMessagingLinkService(repository, provider);
    await service.beginBaleLink({
      baleUserId: id,
      contactUserId: id,
      phoneNumber: managerMobile,
    });
    const rawToken = callbackToken();
    await prisma.company.update({
      where: { id: fixture.company.id },
      data: { isActive: false },
    });

    expect(await service.confirmBaleLink(id, rawToken)).toEqual({
      status: 'rejected',
      reason: 'user_not_eligible',
    });
    expect(
      await repository.findIdentityByExternalId(
        MessagingChannel.BALE,
        id,
      ),
    ).toBeNull();
  });

  it('rechecks membership state during confirmation', async () => {
    const id = baleUserId();
    const service = createMessagingLinkService(repository, provider);
    await service.beginBaleLink({
      baleUserId: id,
      contactUserId: id,
      phoneNumber: managerMobile,
    });
    const rawToken = callbackToken();
    await prisma.companyMembership.update({
      where: { id: fixture.manager.membershipId },
      data: { isActive: false },
    });

    expect(await service.confirmBaleLink(id, rawToken)).toEqual({
      status: 'rejected',
      reason: 'user_not_eligible',
    });
    expect(
      await repository.findIdentityByExternalId(
        MessagingChannel.BALE,
        id,
      ),
    ).toBeNull();
  });

  it('rejects expired challenges and tokens used by another destination', async () => {
    const id = baleUserId();
    const service = createMessagingLinkService(repository, provider);
    await service.beginBaleLink({
      baleUserId: id,
      contactUserId: id,
      phoneNumber: managerMobile,
    });
    const rawToken = callbackToken();

    expect(
      await service.confirmBaleLink(baleUserId(), rawToken),
    ).toEqual({
      status: 'rejected',
      reason: 'invalid_confirmation',
    });

    await prisma.messagingLinkChallenge.updateMany({
      where: {
        channel: MessagingChannel.BALE,
        externalUserId: id,
      },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    expect(await service.confirmBaleLink(id, rawToken)).toEqual({
      status: 'rejected',
      reason: 'invalid_confirmation',
    });
  });

  it('never transfers an existing Bale identity to another user', async () => {
    const id = baleUserId();
    await repository.createIdentity({
      userId: fixture.employees[0]!.id,
      channel: MessagingChannel.BALE,
      externalUserId: id,
      destinationId: id,
      verifiedAt: new Date(),
      verificationMethod: 'P5_TEST',
    });
    const service = createMessagingLinkService(repository, provider);

    expect(
      await service.beginBaleLink({
        baleUserId: id,
        contactUserId: id,
        phoneNumber: managerMobile,
      }),
    ).toEqual({
      status: 'rejected',
      reason: 'identity_conflict',
    });
    expect(
      await repository.findIdentityByExternalId(
        MessagingChannel.BALE,
        id,
      ),
    ).toMatchObject({ userId: fixture.employees[0]!.id });
  });

  it('consumes the challenge if outbound delivery fails', async () => {
    provider.send.mockRejectedValueOnce(new Error('bale_unavailable'));
    const id = baleUserId();
    const service = createMessagingLinkService(repository, provider);

    expect(
      await service.beginBaleLink({
        baleUserId: id,
        contactUserId: id,
        phoneNumber: managerMobile,
      }),
    ).toEqual({
      status: 'rejected',
      reason: 'challenge_delivery_failed',
    });
    expect(
      await prisma.messagingLinkChallenge.findFirstOrThrow({
        where: {
          channel: MessagingChannel.BALE,
          externalUserId: id,
        },
      }),
    ).toMatchObject({ consumedAt: expect.any(Date) });
  });
});

describe('Bale webhook perimeter', () => {
  it('is public only at the exact route and fails closed when disabled', async () => {
    config.baleLinkingEnabled = false;
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/bale/webhook/${webhookSecret}`,
      payload: {},
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      reason: 'bale_linking_disabled',
    });
  });

  it('rejects an incorrect high-entropy webhook path secret', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/bale/webhook/wrong-secret',
      payload: {},
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      reason: 'invalid_webhook_secret',
    });
  });
});
