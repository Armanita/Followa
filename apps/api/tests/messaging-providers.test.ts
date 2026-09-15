import { describe, expect, it, vi } from 'vitest';
import {
  ProviderRegistry,
} from '../src/modules/messaging/provider-registry.js';
import type {
  MessagingProvider,
  MessagingSendRequest,
} from '../src/modules/messaging/messaging-types.js';
import {
  TelegramProvider,
} from '../src/modules/messaging/providers/telegram-provider.js';
import {
  createTelegramNotificationAdapterForTests,
} from '../src/modules/notifications/notification-service.js';

function fakeProvider(
  name: MessagingProvider['name'] = 'telegram',
): MessagingProvider & {
  send: ReturnType<typeof vi.fn>;
} {
  return {
    name,
    send: vi.fn(async (_request: MessagingSendRequest) => undefined),
  };
}

describe('Messaging provider registry', () => {
  it('registers and resolves a provider by its stable name', () => {
    const telegram = fakeProvider();
    const registry = new ProviderRegistry([telegram]);

    expect(registry.get('telegram')).toBe(telegram);
    expect(registry.require('telegram')).toBe(telegram);
    expect(registry.get('bale')).toBeUndefined();
  });

  it('allows registering the same instance idempotently', () => {
    const telegram = fakeProvider();
    const registry = new ProviderRegistry();

    registry.register(telegram);
    registry.register(telegram);

    expect(registry.require('telegram')).toBe(telegram);
  });

  it('rejects silently replacing a registered provider', () => {
    const registry = new ProviderRegistry([fakeProvider()]);

    expect(() => registry.register(fakeProvider())).toThrow(
      'messaging_provider_already_registered:telegram',
    );
  });

  it('fails explicitly when a required provider is absent', () => {
    const registry = new ProviderRegistry();

    expect(() => registry.require('telegram')).toThrow(
      'messaging_provider_not_registered:telegram',
    );
  });
});

describe('Telegram messaging provider', () => {
  it('maps the common request to Telegram without changing text or markup', async () => {
    const sendMessage = vi.fn(async () => ({ ok: true }));
    const provider = new TelegramProvider({ sendMessage });
    const replyMarkup = {
      inline_keyboard: [
        [{ text: '📋 کپی کد', copy_text: { text: '123456' } }],
      ],
    };

    await provider.send({
      destination: '555000111',
      text: 'متن دقیق پیام',
      metadata: { replyMarkup },
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(
      '555000111',
      'متن دقیق پیام',
      replyMarkup,
    );
  });

  it('omits Telegram markup when common metadata is absent', async () => {
    const sendMessage = vi.fn(async () => ({ ok: true }));
    const provider = new TelegramProvider({ sendMessage });

    await provider.send({
      destination: '555000222',
      text: 'اعلان ساده',
    });

    expect(sendMessage).toHaveBeenCalledWith(
      '555000222',
      'اعلان ساده',
      undefined,
    );
  });

  it('propagates provider errors to the existing caller policy', async () => {
    const sendMessage = vi.fn(async () => {
      throw new Error('telegram_unavailable');
    });
    const provider = new TelegramProvider({ sendMessage });

    await expect(
      provider.send({ destination: '555000333', text: 'پیام' }),
    ).rejects.toThrow('telegram_unavailable');
  });
});

describe('Notification to messaging boundary', () => {
  it('resolves the linked identity before calling the common provider', async () => {
    const provider = fakeProvider();
    const adapter = createTelegramNotificationAdapterForTests(
      {
        findIdentityByUserId: async (userId: string) => ({
          userId,
          telegramUserId: '777000111',
        }),
      },
      provider,
    );

    await adapter.send('user-1', 'عنوان', 'متن اعلان');

    expect(provider.send).toHaveBeenCalledTimes(1);
    expect(provider.send).toHaveBeenCalledWith({
      destination: '777000111',
      text: 'عنوان\nمتن اعلان',
    });
  });

  it('keeps in-app-only behavior when no Telegram identity exists', async () => {
    const provider = fakeProvider();
    const adapter = createTelegramNotificationAdapterForTests(
      { findIdentityByUserId: async () => null },
      provider,
    );

    await adapter.send('user-2', 'عنوان', 'متن اعلان');

    expect(provider.send).not.toHaveBeenCalled();
  });
});
