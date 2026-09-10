import { config } from '../../config.js';

export type TelegramSendMessageResult = {
  ok: boolean;
  result?: unknown;
  description?: string;
};

export type TelegramReplyMarkup = {
  keyboard?: Array<Array<{ text: string; request_contact?: boolean }>>;
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  remove_keyboard?: boolean;
};

export function createTelegramClient() {
  return {
    async sendMessage(
      chatId: number | string,
      text: string,
      replyMarkup?: TelegramReplyMarkup,
    ): Promise<TelegramSendMessageResult> {
      if (!config.telegramBotToken) {
        throw new Error('telegram_bot_token_missing');
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
            ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
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
