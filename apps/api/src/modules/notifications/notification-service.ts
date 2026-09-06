import { prisma } from '../../lib/prisma.js';
import { config } from '../../config.js';
import { createTelegramClient } from '../telegram/telegram-client.js';
import { createTelegramRepository } from '../telegram/telegram-repository.js';

export interface NotificationInput {
  userId: string;
  type:
    | 'CASE_ASSIGNED'
    | 'CASE_ACCEPTED'
    | 'CASE_REJECTED'
    | 'REMINDER_DUE'
    | 'CASE_COMPLETED'
    | 'CASE_UPDATED';
  title: string;
  body?: string;
  linkType?: string;
  linkId?: string;
}

export interface PushAdapter {
  readonly name: string;
  send(userId: string, title: string, body: string): Promise<void>;
}

class MockPushAdapter implements PushAdapter {
  readonly name = 'mock';
  async send(userId: string, title: string, body: string): Promise<void> {
    console.log(`[push:mock] to=${userId} "${title}" ${body}`);
  }
}

class MessengerNotificationAdapter implements PushAdapter {
  readonly name: string;
  constructor(private platform: 'bale' | 'eitaa', private token: string | undefined) {
    this.name = platform;
  }
  async send(userId: string, title: string, body: string): Promise<void> {
    if (!this.token) throw new Error(`${this.platform} adapter not configured`);
    console.log(`[push:${this.platform}] would message user ${userId}: ${title} — ${body}`);
  }
}

class TelegramNotificationAdapter implements PushAdapter {
  readonly name = 'telegram';
  private readonly telegramClient = createTelegramClient();
  private readonly telegramRepository = createTelegramRepository(prisma);

  async send(userId: string, title: string, body: string): Promise<void> {
    const identity = await this.telegramRepository.findIdentityByUserId(userId);
    if (!identity) return; // user has no linked Telegram account — in-app row is the delivery

    await this.telegramClient.sendMessage(identity.telegramUserId, `${title}\n${body}`);
  }
}

function createPushAdapter(): PushAdapter {
  switch (config.notificationProvider) {
    case 'bale':
      return new MessengerNotificationAdapter('bale', process.env.BALE_BOT_TOKEN);
    case 'eitaa':
      return new MessengerNotificationAdapter('eitaa', process.env.EITAA_BOT_TOKEN);
    case 'telegram':
      return new TelegramNotificationAdapter();
    default:
      return new MockPushAdapter();
  }
}

const pushAdapter = createPushAdapter();

export const notificationService = {
  pushAdapter,

  async notify(input: NotificationInput): Promise<void> {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        linkType: input.linkType,
        linkId: input.linkId,
      },
    });
    if (input.body !== undefined) {
      await pushAdapter.send(input.userId, input.title, input.body).catch((err) => {
        console.error('[notifications] external delivery failed', err);
      });
    }
  },
};
