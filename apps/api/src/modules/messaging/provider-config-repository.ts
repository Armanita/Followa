import type { MessagingChannel, MessagingSystemPolicy } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

/**
 * P11-A — Provider configuration repository.
 *
 * Encapsulates all database access for system-level provider
 * configuration stored in MessagingSystemPolicy. The repository
 * works with encrypted credentials; it never decrypts or validates
 * secrets — that responsibility belongs to the service layer.
 */

export type ProviderConfigRow = Pick<
  MessagingSystemPolicy,
  | 'channel'
  | 'displayName'
  | 'botUsername'
  | 'credentialsEncrypted'
  | 'enabled'
  | 'notificationEnabled'
  | 'otpEnabled'
  | 'createdAt'
  | 'updatedAt'
>;

export interface UpsertProviderConfigInput {
  channel: MessagingChannel;
  displayName: string;
  botUsername: string | null;
  credentialsEncrypted?: string | null;
  enabled: boolean;
  notificationEnabled: boolean;
  otpEnabled: boolean;
}

/** Fetch all provider configurations for the given channels. */
export async function findAllProviderConfigs(
  channels: readonly MessagingChannel[],
): Promise<Map<MessagingChannel, ProviderConfigRow>> {
  const rows = await prisma.messagingSystemPolicy.findMany({
    where: { channel: { in: [...channels] } },
  });
  return new Map(rows.map((row) => [row.channel, row]));
}

/** Fetch a single provider configuration by channel. */
export async function findProviderConfig(
  channel: MessagingChannel,
): Promise<ProviderConfigRow | null> {
  return prisma.messagingSystemPolicy.findUnique({ where: { channel } });
}

/** Upsert multiple provider configurations in a single transaction. */
export async function upsertProviderConfigs(
  inputs: UpsertProviderConfigInput[],
): Promise<void> {
  await prisma.$transaction(
    inputs.map(({ channel, credentialsEncrypted, ...data }) => {
      const credentialUpdate =
        credentialsEncrypted !== undefined
          ? { credentialsEncrypted }
          : {};
      return prisma.messagingSystemPolicy.upsert({
        where: { channel },
        create: {
          channel,
          ...data,
          credentialsEncrypted: credentialsEncrypted ?? null,
        },
        update: { ...data, ...credentialUpdate },
      });
    }),
  );
}
