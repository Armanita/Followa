import { MessagingChannel } from '@prisma/client';
import type { MessagingProvider, MessagingSendRequest } from './messaging-types.js';
import { getRuntimeProviderConfig } from './provider-config-service.js';
import { createTelegramClient } from '../telegram/telegram-client.js';
import { createBaleClient } from '../bale/bale-client.js';
import type { TelegramReplyMarkup } from '../telegram/telegram-client.js';
import type { BaleReplyMarkup } from '../bale/bale-client.js';
function replyMarkup(metadata: MessagingSendRequest['metadata']) { return (metadata as { replyMarkup?: TelegramReplyMarkup | BaleReplyMarkup } | undefined)?.replyMarkup; }
export class DatabaseConfiguredProvider implements MessagingProvider { readonly name: 'telegram' | 'bale'; constructor(private readonly channel: MessagingChannel.TELEGRAM | MessagingChannel.BALE) { this.name = channel === MessagingChannel.TELEGRAM ? 'telegram' : 'bale'; } async send(request: MessagingSendRequest): Promise<void> { const current = await getRuntimeProviderConfig(this.channel); if (!current) throw new Error(`${this.name}_provider_not_configured`); if (this.channel === MessagingChannel.TELEGRAM) { await createTelegramClient(current.botToken).sendMessage(request.destination, request.text, replyMarkup(request.metadata) as TelegramReplyMarkup | undefined); return; } await createBaleClient(current.botToken).sendMessage(request.destination, request.text, replyMarkup(request.metadata) as BaleReplyMarkup | undefined); } }
export function getDatabaseConfiguredProvider(channel: MessagingChannel.TELEGRAM | MessagingChannel.BALE): MessagingProvider { return new DatabaseConfiguredProvider(channel); }
