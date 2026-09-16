import { MessagingChannel, NotificationType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { createNotificationDispatcher } from '../messaging/notification-dispatcher.js';
import type { MessagingProvider } from '../messaging/messaging-types.js';
import { getDatabaseConfiguredProvider } from '../messaging/db-backed-provider.js';
import { createTelegramRepository } from '../telegram/telegram-repository.js';
export interface NotificationInput { userId: string; companyId?: string; type: NotificationType; title: string; body?: string; linkType?: string; linkId?: string; }
type ManagerNotificationInput = Omit<NotificationInput, 'userId'> & { companyId: string; excludeUserId?: string };
export interface PushAdapter { readonly name: string; send(userId: string, title: string, body: string): Promise<void> }
type TelegramNotificationRepository = { findIdentityByUserId(userId: string): Promise<{ telegramUserId: string; userId: string } | null> };
class DatabaseTelegramAdapter implements PushAdapter { readonly name = 'telegram-db'; constructor(private readonly repository: TelegramNotificationRepository = createTelegramRepository(prisma), private readonly provider: MessagingProvider = getDatabaseConfiguredProvider(MessagingChannel.TELEGRAM)) {} async send(userId: string, title: string, body: string): Promise<void> { const identity = await this.repository.findIdentityByUserId(userId); if (identity) await this.provider.send({ destination: identity.telegramUserId, text: `${title}\n${body}` }); } }
export function createTelegramNotificationAdapterForTests(repository: TelegramNotificationRepository, provider: MessagingProvider): PushAdapter { return new DatabaseTelegramAdapter(repository, provider); }
const dispatcher = createNotificationDispatcher(prisma);
export const notificationService = { pushAdapter: new DatabaseTelegramAdapter(), async notify(input: NotificationInput): Promise<void> { await dispatcher.enqueue(input); }, async notifyActiveCompanyManagers(input: ManagerNotificationInput): Promise<void> { const memberships = await prisma.companyMembership.findMany({ where: { companyId: input.companyId, role: 'COMPANY_MANAGER', isActive: true }, select: { userId: true } }); const userIds = [...new Set(memberships.map((membership) => membership.userId))].filter((userId) => userId !== input.excludeUserId); await Promise.all(userIds.map((userId) => notificationService.notify({ userId, companyId: input.companyId, type: input.type, title: input.title, body: input.body, linkType: input.linkType, linkId: input.linkId }))); } };
