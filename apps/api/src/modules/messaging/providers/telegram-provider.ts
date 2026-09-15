import type {
  MessagingProvider,
  MessagingSendRequest,
} from '../messaging-types.js';
import { providerRegistry, type ProviderRegistry } from '../provider-registry.js';
import {
  createTelegramClient,
  type TelegramReplyMarkup,
} from '../../telegram/telegram-client.js';

type TelegramClient = {
  sendMessage(
    chatId: number | string,
    text: string,
    replyMarkup?: TelegramReplyMarkup,
  ): Promise<unknown>;
};

type TelegramMetadata = {
  replyMarkup?: TelegramReplyMarkup;
};

function getReplyMarkup(
  metadata: MessagingSendRequest['metadata'],
): TelegramReplyMarkup | undefined {
  return (metadata as TelegramMetadata | undefined)?.replyMarkup;
}

export class TelegramProvider implements MessagingProvider {
  readonly name = 'telegram' as const;

  constructor(
    private readonly client: TelegramClient = createTelegramClient(),
  ) {}

  async send(request: MessagingSendRequest): Promise<void> {
    await this.client.sendMessage(
      request.destination,
      request.text,
      getReplyMarkup(request.metadata),
    );
  }
}

/**
 * Lazily registers one Telegram adapter. Importing the module does not create
 * a network request and repeated consumers share the same provider instance.
 */
export function getTelegramProvider(
  registry: ProviderRegistry = providerRegistry,
): MessagingProvider {
  const existing = registry.get('telegram');
  if (existing) {
    return existing;
  }

  const provider = new TelegramProvider();
  registry.register(provider);
  return provider;
}
