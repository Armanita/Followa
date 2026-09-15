import type {
  MessagingProvider,
  MessagingSendRequest,
} from '../messaging-types.js';
import {
  providerRegistry,
  type ProviderRegistry,
} from '../provider-registry.js';
import {
  createBaleClient,
  type BaleReplyMarkup,
} from '../../bale/bale-client.js';

type BaleClient = {
  sendMessage(
    chatId: number | string,
    text: string,
    replyMarkup?: BaleReplyMarkup,
  ): Promise<void>;
};

function replyMarkup(
  metadata: MessagingSendRequest['metadata'],
): BaleReplyMarkup | undefined {
  return (
    metadata as { replyMarkup?: BaleReplyMarkup } | undefined
  )?.replyMarkup;
}

export class BaleProvider implements MessagingProvider {
  readonly name = 'bale' as const;

  constructor(
    private readonly client: BaleClient = createBaleClient(),
  ) {}

  async send(request: MessagingSendRequest): Promise<void> {
    await this.client.sendMessage(
      request.destination,
      request.text,
      replyMarkup(request.metadata),
    );
  }
}

export function getBaleProvider(
  registry: ProviderRegistry = providerRegistry,
): MessagingProvider {
  const existing = registry.get('bale');
  if (existing) {
    return existing;
  }
  const provider = new BaleProvider();
  registry.register(provider);
  return provider;
}
