import type { FastifyInstance } from 'fastify';
import { config } from '../../config.js';
import { prisma } from '../../lib/prisma.js';
import { createTelegramRepository } from './telegram-repository.js';
import { createTelegramClient } from './telegram-client.js';
import { createTelegramService } from './telegram-service.js';

type TelegramWebhookUpdate = {
  message?: {
    text?: string;
    from?: {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
    contact?: {
      phone_number: string;
    };
  };
};

export async function telegramRoutes(app: FastifyInstance) {
  const repository = createTelegramRepository(prisma);
  const telegramClient = createTelegramClient();
  const service = createTelegramService(repository, telegramClient);

  app.post('/telegram/webhook', async (request) => {
    if (
      config.telegramWebhookSecret &&
      request.headers['x-telegram-bot-api-secret-token'] !== config.telegramWebhookSecret
    ) {
      return {
        status: 'rejected',
        reason: 'invalid_webhook_secret',
      };
    }

    const update = request.body as TelegramWebhookUpdate;
    const message = update.message;
    const telegramUserId = message?.from?.id;

    if (!telegramUserId || !message.from) {
      return { status: 'ignored' };
    }

    if (message.text === '/start') {
      return service.handleStart({
        telegramUserId,
        username: message.from.username,
        firstName: message.from.first_name,
        lastName: message.from.last_name,
      });
    }

    if (message.contact) {
      return service.handleContact({
        telegramUserId,
        username: message.from.username,
        firstName: message.from.first_name,
        lastName: message.from.last_name,
        phoneNumber: message.contact.phone_number,
      });
    }

    return { status: 'ignored' };
  });

  app.post('/telegram/confirm', async (request) => {
    const body = request.body as {
      telegramUserId?: number;
      phoneNumber?: string;
    };

    if (!body.telegramUserId || !body.phoneNumber) {
      return {
        status: 'rejected',
        reason: 'invalid_confirmation_payload',
      };
    }

    const pending = await repository.getPendingConnection(String(body.telegramUserId));

    if (!pending) {
      return {
        status: 'rejected',
        reason: 'pending_connection_not_found',
      };
    }

    try {
      return await service.confirmConnection(
        {
          telegramUserId: body.telegramUserId,
          phoneNumber: body.phoneNumber,
        },
        pending.userId,
      );
    } catch {
      return {
        status: 'rejected',
        reason: 'identity_confirmation_failed',
      };
    }
  });
}
