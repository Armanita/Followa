import { getTelegramBotToken } from '../messaging/provider-config-service.js';
export type TelegramSendMessageResult = { ok: boolean; result?: unknown; description?: string };
export type TelegramReplyMarkup = { keyboard?: Array<Array<{ text: string; request_contact?: boolean }>>; inline_keyboard?: Array<Array<{ text: string; callback_data?: string; copy_text?: { text: string } }>>; resize_keyboard?: boolean; one_time_keyboard?: boolean; remove_keyboard?: boolean };
export function createTelegramClient(botToken?: string) {
  return {
    async sendMessage(chatId: number | string, text: string, replyMarkup?: TelegramReplyMarkup): Promise<TelegramSendMessageResult> {
      const token = botToken ?? (await getTelegramBotToken());
      if (!token || !token.trim()) throw new Error('telegram_bot_token_missing');
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) }), signal: AbortSignal.timeout(10_000) });
      const data = (await response.json()) as TelegramSendMessageResult;
      if (!response.ok || !data.ok) throw new Error(data.description ?? 'telegram_send_message_failed');
      return data;
    },
  };
}
export async function createTelegramClientFromDb(): Promise<ReturnType<typeof createTelegramClient>> {
  const token = await getTelegramBotToken();
  if (!token) throw new Error('telegram_bot_token_missing');
  return createTelegramClient(token);
}
