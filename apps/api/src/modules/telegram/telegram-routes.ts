import type { FastifyInstance } from 'fastify';
import { config } from '../../config.js';
import { prisma } from '../../lib/prisma.js';
import { createTelegramRepository } from './telegram-repository.js';
import { createTelegramClient } from './telegram-client.js';
import { createTelegramService } from './telegram-service.js';

type TelegramWebhookUpdate = {
  message?: {
    text?: string;
    chat?: { type?: string };
    from?: { id: number; username?: string; first_name?: string; last_name?: string };
    contact?: { phone_number: string; user_id?: number };
  };
  callback_query?: { id: string; data?: string; from?: { id: number } };
};

export async function telegramRoutes(app: FastifyInstance) {
  const repository = createTelegramRepository(prisma);
  const telegramClient = createTelegramClient();
  const service = createTelegramService(repository, telegramClient);

  app.post('/telegram/webhook', async (request) => {
    if (config.telegramWebhookSecret && request.headers['x-telegram-bot-api-secret-token'] !== config.telegramWebhookSecret) {
      return { status: 'rejected', reason: 'invalid_webhook_secret' };
    }

    const update = request.body as TelegramWebhookUpdate;

    if (update.callback_query?.data === 'telegram_confirm') {
      const telegramUserId = update.callback_query.from?.id;
      if (!telegramUserId) return { status: 'ignored' };
      const result = await repository.confirmPendingConnection(String(telegramUserId));
      if (result) await telegramClient.sendMessage(telegramUserId, 'اتصال حساب تلگرام شما با موفقیت انجام شد.');
      return result ?? { status: 'rejected', reason: 'pending_connection_not_found' };
    }

    const message = update.message;
    const telegramUserId = message?.from?.id;
    if (!telegramUserId || !message.from || message.chat?.type && message.chat.type !== 'private') return { status: 'ignored' };

    if (message.text === '/start') {
      return service.handleStart({ telegramUserId, username: message.from.username, firstName: message.from.first_name, lastName: message.from.last_name });
    }

    if (message.contact) {
      if (message.contact.user_id && message.contact.user_id !== telegramUserId) return { status: 'rejected', reason: 'contact_owner_mismatch' };
      return service.handleContact({ telegramUserId, username: message.from.username, firstName: message.from.first_name, lastName: message.from.last_name, phoneNumber: message.contact.phone_number });
    }

    return { status: 'ignored' };
  });

  app.post('/telegram/confirm', async (request) => {
    const body = request.body as { telegramUserId?: number; phoneNumber?: string };
    if (!body.telegramUserId || !body.phoneNumber) return { status: 'rejected', reason: 'invalid_confirmation_payload' };
    return { status: 'rejected', reason: 'direct_confirmation_disabled' };
  });
}
