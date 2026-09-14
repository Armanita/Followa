import type { MessagingProvider, MessagingSendRequest } from '../messaging-types.js';
import { createTelegramClient } from '../../telegram/telegram-client.js';

export class TelegramProvider implements MessagingProvider {
  readonly name = 'telegram' as const;
  private readonly client = createTelegramClient();

  async send(request: MessagingSendRequest): Promise<void> {
    await this.client.sendMessage(request.destination, request.text);
  }
}
