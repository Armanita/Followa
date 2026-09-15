import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { config } from '../../config.js';
import { prisma } from '../../lib/prisma.js';
import { createMessagingLinkService } from '../messaging/messaging-link-service.js';
import { createMessagingRepository } from '../messaging/messaging-repository.js';
import { getBaleProvider } from '../messaging/providers/bale-provider.js';
import { createBaleService } from './bale-service.js';
import { createBaleClient } from './bale-client.js';

type BaleChat = { id: number; type: string };
type BaleWebhookUpdate = {
  message?: {
    text?: string;
    chat?: BaleChat;
    from?: { id: number };
    contact?: { phone_number: string; user_id?: number };
  };
  callback_query?: {
    id?: string;
    data?: string;
    from?: { id: number };
    message?: { chat?: BaleChat };
  };
};

function privateSenderId(id: unknown, chat?: BaleChat): string | null {
  if (
    typeof id !== 'number' ||
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    chat?.type !== 'private' ||
    chat.id !== id
  ) {
    return null;
  }
  return String(id);
}

function validWebhookSecret(supplied: string): boolean {
  const expected = config.baleWebhookSecret;
  return (
    expected.length >= 32 &&
    Buffer.byteLength(supplied) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  );
}

export async function baleRoutes(app: FastifyInstance) {
  const repository = createMessagingRepository(prisma);
  const provider = getBaleProvider();
  const linkService = createMessagingLinkService(repository, provider);
  const service = createBaleService(linkService, provider);
  const baleClient = createBaleClient();

  app.post(
    '/bale/webhook/:webhookSecret',
    // The fallback bearer is in the URL because Bale setWebhook currently has
    // no documented secret header. Suppress application request logging.
    { logLevel: 'silent' },
    async (request, reply) => {
      if (
        !config.baleLinkingEnabled ||
        !config.baleBotToken.trim() ||
        !config.baleWebhookSecret.trim()
      ) {
        return reply.code(503).send({
          status: 'rejected',
          reason: 'bale_linking_disabled',
        });
      }

      const { webhookSecret } = request.params as {
        webhookSecret: string;
      };
      if (!validWebhookSecret(webhookSecret)) {
        return reply.code(403).send({
          status: 'rejected',
          reason: 'invalid_webhook_secret',
        });
      }

      const update = (request.body ?? {}) as BaleWebhookUpdate;
      if (update.callback_query) {
        const callback = update.callback_query;
        const baleUserId = privateSenderId(
          callback.from?.id,
          callback.message?.chat,
        );
        if (!baleUserId) {
          return {
            status: 'rejected',
            reason: 'private_chat_required',
          };
        }
        const match =
          typeof callback.data === 'string'
            ? /^bale_confirm:([a-f0-9]{32})$/.exec(callback.data)
            : null;
        if (!match) {
          if (typeof callback.id === 'string') {
            await baleClient
              .answerCallbackQuery(callback.id)
              .catch(() => undefined);
          }
          return {
            status: 'rejected',
            reason: 'invalid_confirmation',
          };
        }
        const result = await service.confirmConnection(
          baleUserId,
          match[1]!,
        );
        if (typeof callback.id === 'string') {
          await baleClient
            .answerCallbackQuery(callback.id)
            .catch(() => undefined);
        }
        return result;
      }

      const message = update.message;
      if (!message) {
        return { status: 'ignored' };
      }
      const baleUserId = privateSenderId(
        message.from?.id,
        message.chat,
      );
      if (!baleUserId) {
        return {
          status: 'rejected',
          reason: 'private_chat_required',
        };
      }
      if (message.text === '/start') {
        return service.handleStart(baleUserId);
      }
      if (message.contact) {
        if (
          typeof message.contact.user_id !== 'number' ||
          !Number.isSafeInteger(message.contact.user_id) ||
          typeof message.contact.phone_number !== 'string'
        ) {
          return {
            status: 'rejected',
            reason: 'contact_owner_mismatch',
          };
        }
        return service.handleContact({
          baleUserId,
          contactUserId: String(message.contact.user_id),
          phoneNumber: message.contact.phone_number,
        });
      }
      return { status: 'ignored' };
    },
  );
}
