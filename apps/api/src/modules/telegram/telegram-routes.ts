import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { createTelegramClient } from './telegram-client.js';
import { createTelegramRepository } from './telegram-repository.js';
import { createTelegramService } from './telegram-service.js';
import { getTelegramWebhookSecret } from '../messaging/provider-config-service.js';
import { config } from '../../config.js';

type TelegramChat = { id: number; type: string };
type TelegramWebhookUpdate = {
  message?: {
    text?: string;
    chat?: TelegramChat;
    from?: { id: number };
    contact?: { phone_number: string; user_id?: number };
  };
  callback_query?: {
    data?: string;
    from?: { id: number };
    message?: { chat?: TelegramChat };
  };
};

function isPrivateSender(id: unknown, chat?: TelegramChat): id is number {
  return (
    typeof id === 'number' &&
    Number.isSafeInteger(id) &&
    id > 0 &&
    chat?.type === 'private' &&
    chat.id === id
  );
}

export async function telegramRoutes(app: FastifyInstance) {
  const repository = createTelegramRepository(prisma);
  const telegramClient = createTelegramClient();
  const service = createTelegramService(repository, telegramClient);

  app.post('/telegram/webhook', async (request, reply) => {
    const secret = (await getTelegramWebhookSecret()) ?? config.telegramWebhookSecret;

    // This route only links identities. Missing configuration disables new linking,
    // while existing outgoing Telegram OTP and notifications remain untouched.
    if (!secret?.trim()) {
      return reply.code(503).send({
        status: 'rejected',
        reason: 'telegram_linking_disabled',
      });
    }

    const suppliedSecret = request.headers['x-telegram-bot-api-secret-token'];
    if (
      typeof suppliedSecret !== 'string' ||
      Buffer.byteLength(suppliedSecret) !== Buffer.byteLength(secret) ||
      !timingSafeEqual(Buffer.from(suppliedSecret), Buffer.from(secret))
    ) {
      return reply.code(403).send({
        status: 'rejected',
        reason: 'invalid_webhook_secret',
      });
    }

    const update = (request.body ?? {}) as TelegramWebhookUpdate;

    if (update.callback_query) {
      const callback = update.callback_query;
      const telegramUserId = callback.from?.id;

      if (!isPrivateSender(telegramUserId, callback.message?.chat)) {
        return { status: 'rejected', reason: 'private_chat_required' };
      }

      const match =
        typeof callback.data === 'string'
          ? /^telegram_confirm:([a-f0-9]{32})$/.exec(callback.data)
          : null;

      if (!match) {
        return { status: 'rejected', reason: 'invalid_confirmation' };
      }

      return service.confirmConnection(telegramUserId, match[1]!);
    }

    const message = update.message;
    if (!message) {
      return { status: 'ignored' };
    }

    const telegramUserId = message.from?.id;
    if (!isPrivateSender(telegramUserId, message.chat)) {
      return { status: 'rejected', reason: 'private_chat_required' };
    }

    if (message.text === '/start') {
      return service.handleStart({ telegramUserId });
    }

    if (message.contact) {
      if (
        message.contact.user_id !== telegramUserId ||
        typeof message.contact.phone_number !== 'string'
      ) {
        return { status: 'rejected', reason: 'contact_owner_mismatch' };
      }

      return service.handleContact({
        telegramUserId,
        contactUserId: message.contact.user_id,
        phoneNumber: message.contact.phone_number,
      });
    }

    return { status: 'ignored' };
  });

  // Confirmation is accepted only through an authenticated Telegram callback.
  // The former unauthenticated /telegram/confirm endpoint is intentionally absent.
}
