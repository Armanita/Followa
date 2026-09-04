import { config } from '../../config.js';

export type TelegramSendMessageResult = {
  ok: boolean;
  result?: unknown;
  description?: string;
};

export function createTelegramClient() {
  return {
    async sendMessage(chatId: number | string, text: string): Promise<TelegramSendMessageResult> {
      if (!config.telegramBotToken) {
        return {
          ok: false,
          description: 'telegram_bot_token_missing',
        };
      }

      const response = await fetch(
        `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            text,
          }),
        },
      );

      const data = (await response.json()) as TelegramSendMessageResult;

      if (!response.ok || !data.ok) {
        throw new Error(data.description ?? 'telegram_send_message_failed');
      }

      return data;
    },
  };
}