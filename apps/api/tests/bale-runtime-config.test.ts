import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { config } from '../src/config.js';
import { encryptProviderCredentials } from '../src/modules/messaging/provider-configuration.js';

const mocks = vi.hoisted(() => ({
  db: {} as Record<string, unknown>,
}));

vi.mock('../src/lib/prisma.js', () => ({ prisma: mocks.db }));

const dbToken = '987654321:TEST_BALE_DB_TOKEN_ABCDEF';
const dbSecret = 'test-bale-db-webhook-secret-0123456789abcdef';
const testKey = 'test-only-master-key-with-at-least-32-characters';

const originalKey = config.messagingCredentialsKey;
const originalEnvKey = process.env.MESSAGING_CREDENTIALS_KEY;
const originalBotToken = config.baleBotToken;
const originalWebhookSecret = config.baleWebhookSecret;
const originalEnvBotToken = process.env.BALE_BOT_TOKEN;
const originalLinkingEnabled = config.baleLinkingEnabled;
const originalEnvWebhookSecret = process.env.BALE_WEBHOOK_SECRET;

beforeEach(async () => {
  config.messagingCredentialsKey = testKey;
  process.env.MESSAGING_CREDENTIALS_KEY = testKey;
  const encrypted = encryptProviderCredentials({ botToken: dbToken, webhookSecret: dbSecret }, testKey);
  (mocks.db as Record<string, unknown>).messagingSystemPolicy = {
    findUnique: vi.fn(async ({ where }: { where: { channel: string } }) => {
      if (where.channel === 'BALE') {
        return {
          channel: 'BALE',
          displayName: 'بله',
          botUsername: 'test_bale_bot',
          credentialsEncrypted: encrypted,
          enabled: true,
          notificationEnabled: true,
          otpEnabled: true,
        };
      }
      return null;
    }),
    findMany: vi.fn(async () => []),
  };
});

afterEach(() => {
  config.messagingCredentialsKey = originalKey;
  process.env.MESSAGING_CREDENTIALS_KEY = originalEnvKey;
  config.baleBotToken = originalBotToken;
  process.env.BALE_BOT_TOKEN = originalEnvBotToken;
  config.baleWebhookSecret = originalWebhookSecret;
  process.env.BALE_WEBHOOK_SECRET = originalEnvWebhookSecret;
  config.baleLinkingEnabled = originalLinkingEnabled;
  vi.restoreAllMocks();
});

describe('Bale DB-backed runtime configuration', () => {
  it('getBaleBotToken returns DB token', async () => {
    const { getBaleBotToken } = await import('../src/modules/messaging/provider-config-service.js');
    await expect(getBaleBotToken()).resolves.toBe(dbToken);
  });

  it('getBaleWebhookSecret returns DB secret', async () => {
    const { getBaleWebhookSecret } = await import('../src/modules/messaging/provider-config-service.js');
    await expect(getBaleWebhookSecret()).resolves.toBe(dbSecret);
  });

  it('Bale client uses DB token without ENV', async () => {
    process.env.BALE_BOT_TOKEN = '';
    config.baleBotToken = '';
    const { createBaleClient } = await import('../src/modules/bale/bale-client.js');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: {} }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    try {
      const client = createBaleClient();
      await client.sendMessage('123', 'test');
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(dbToken),
        expect.any(Object),
      );
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('ENV token is not required after DB config', async () => {
    config.baleBotToken = '';
    process.env.BALE_BOT_TOKEN = '';
    const { getBaleRuntimeConfig } = await import('../src/modules/messaging/provider-config-service.js');
    const runtime = await getBaleRuntimeConfig();
    expect(runtime?.botToken).toBe(dbToken);
    expect(runtime?.webhookSecret).toBe(dbSecret);
  });

  it('Bale works with DB config and empty BALE_* env values', async () => {
    process.env.BALE_BOT_TOKEN = '';
    config.baleBotToken = '';
    process.env.BALE_WEBHOOK_SECRET = '';
    config.baleWebhookSecret = '';
    config.baleLinkingEnabled = false;
    const { getBaleRuntimeConfig, isBaleLinkingEnabled, getBaleBotToken } = await import('../src/modules/messaging/provider-config-service.js');
    const runtime = await getBaleRuntimeConfig();
    expect(runtime?.botToken).toBe(dbToken);
    await expect(isBaleLinkingEnabled()).resolves.toBe(true);
    await expect(getBaleBotToken()).resolves.toBe(dbToken);
  });

  it('DB webhookSecret overrides ENV webhookSecret', async () => {
    process.env.BALE_WEBHOOK_SECRET = 'env-wrong-secret-00000000000000000000';
    config.baleWebhookSecret = 'env-wrong-secret-00000000000000000000';
    const { getBaleWebhookSecret, getBaleRuntimeConfig } = await import('../src/modules/messaging/provider-config-service.js');
    await expect(getBaleWebhookSecret()).resolves.toBe(dbSecret);
    const runtime = await getBaleRuntimeConfig();
    expect(runtime?.webhookSecret).toBe(dbSecret);
    expect(runtime?.webhookSecret).not.toBe('env-wrong-secret-00000000000000000000');
  });

  it('Disabled DB policy rejects linking even with ENV enabled', async () => {
    const encrypted = encryptProviderCredentials({ botToken: dbToken, webhookSecret: dbSecret }, testKey);
    (mocks.db as Record<string, unknown>).messagingSystemPolicy = {
      findUnique: vi.fn(async () => ({
        channel: 'BALE',
        displayName: 'بله',
        botUsername: 'test_bale_bot',
        credentialsEncrypted: encrypted,
        enabled: false,
        notificationEnabled: false,
        otpEnabled: false,
      })),
      findMany: vi.fn(async () => []),
    };
    config.baleLinkingEnabled = true;
    const { isBaleLinkingEnabled } = await import('../src/modules/messaging/provider-config-service.js');
    await expect(isBaleLinkingEnabled()).resolves.toBe(false);
  });
});
