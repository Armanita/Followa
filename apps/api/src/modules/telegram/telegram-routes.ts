import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { createTelegramRepository } from './telegram-repository.js';
import { createTelegramService } from './telegram-service.js';

export async function telegramRoutes(app: FastifyInstance) {
  const repository = createTelegramRepository(prisma);
  const service = createTelegramService(repository);

  app.post('/telegram/webhook', async (request) => {
    const update = request.body as Record<string, any>;

    if (update.message?.text === '/start') {
      return service.handleStart({
        telegramUserId: update.message.from.id,
        username: update.message.from.username,
        firstName: update.message.from.first_name,
        lastName: update.message.from.last_name,
      });
    }

    if (update.message?.contact) {
      return service.handleContact({
        telegramUserId: update.message.from.id,
        username: update.message.from.username,
        firstName: update.message.from.first_name,
        lastName: update.message.from.last_name,
        phoneNumber: update.message.contact.phone_number,
      });
    }

    return { status: 'ignored' };
  });
}
