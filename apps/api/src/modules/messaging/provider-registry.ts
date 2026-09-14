import type { MessagingProvider, MessagingProviderName } from './messaging-types.js';

export class ProviderRegistry {
  private readonly providers = new Map<MessagingProviderName, MessagingProvider>();

  register(provider: MessagingProvider): void {
    this.providers.set(provider.name, provider);
  }

  get(name: MessagingProviderName): MessagingProvider | undefined {
    return this.providers.get(name);
  }
}

export const providerRegistry = new ProviderRegistry();
