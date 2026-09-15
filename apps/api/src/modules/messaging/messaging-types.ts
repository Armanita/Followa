export type MessagingProviderName = 'telegram' | 'bale' | 'eitaa';

export interface MessagingSendRequest {
  /** Provider-owned destination, never accepted directly from an API caller. */
  destination: string;
  text: string;
  /** Opaque provider-specific rendering data; authentication data is forbidden. */
  metadata?: Readonly<Record<string, unknown>>;
}

export interface MessagingProvider {
  readonly name: MessagingProviderName;
  send(request: MessagingSendRequest): Promise<void>;
}
