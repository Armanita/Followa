import { prisma } from '../../lib/prisma.js';
import { config } from '../../config.js';
import type { MessagingProvider } from '../messaging/messaging-types.js';
import { getTelegramProvider } from '../messaging/providers/telegram-provider.js';
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

type ManagerNotificationInput = Omit<NotificationInput, 'userId'> & {
  companyId: string;
  excludeUserId?: string;
};

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

type TelegramNotificationRepository = {
  findIdentityByUserId(
    userId: string,
  ): Promise<{ telegramUserId: string; userId: string } | null>;
};

class TelegramNotificationAdapter implements PushAdapter {
  readonly name = 'telegram';

  constructor(
    private readonly telegramRepository: TelegramNotificationRepository =
      createTelegramRepository(prisma),
    private readonly provider: MessagingProvider = getTelegramProvider(),
  ) {}

  async send(userId: string, title: string, body: string): Promise<void> {
    const identity =
      await this.telegramRepository.findIdentityByUserId(userId);
    if (!identity) {
      return; // The in-app row remains the delivery for an unlinked user.
    }

    await this.provider.send({
      destination: identity.telegramUserId,
      text: `${title}\n${body}`,
    });
  }
}

export function createTelegramNotificationAdapterForTests(
  repository: TelegramNotificationRepository,
  provider: MessagingProvider,
): PushAdapter {
  return new TelegramNotificationAdapter(repository, provider);
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

  async notifyActiveCompanyManagers(input: ManagerNotificationInput): Promise<void> {
    const memberships = await prisma.companyMembership.findMany({
      where: {
        companyId: input.companyId,
        role: 'COMPANY_MANAGER',
        isActive: true,
      },
      select: { userId: true },
    });

    const userIds = [...new Set(memberships.map((membership) => membership.userId))]
      .filter((userId) => userId !== input.excludeUserId);

    await Promise.all(
      userIds.map((userId) => notificationService.notify({
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        linkType: input.linkType,
        linkId: input.linkId,
      })),
    );
  },
};
