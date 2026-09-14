export type MessagingProviderName = 'telegram' | 'bale' | 'eitaa';

export interface MessagingSendRequest {
  destination: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export interface MessagingProvider {
  readonly name: MessagingProviderName;
  send(request: MessagingSendRequest): Promise<void>;
}
