import type {
  MessagingProvider,
  MessagingProviderName,
} from './messaging-types.js';

export class ProviderRegistry {
  private readonly providers = new Map<
    MessagingProviderName,
    MessagingProvider
  >();

  constructor(providers: readonly MessagingProvider[] = []) {
    for (const provider of providers) {
      this.register(provider);
    }
  }

  register(provider: MessagingProvider): void {
    const existing = this.providers.get(provider.name);
    if (existing && existing !== provider) {
      throw new Error(
        `messaging_provider_already_registered:${provider.name}`,
      );
    }
    this.providers.set(provider.name, provider);
  }

  get(name: MessagingProviderName): MessagingProvider | undefined {
    return this.providers.get(name);
  }

  require(name: MessagingProviderName): MessagingProvider {
    const provider = this.get(name);
    if (!provider) {
      throw new Error(`messaging_provider_not_registered:${name}`);
    }
    return provider;
  }
}

export const providerRegistry = new ProviderRegistry();
