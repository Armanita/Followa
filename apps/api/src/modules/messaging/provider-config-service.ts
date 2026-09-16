import type { MessagingChannel } from '@prisma/client';
import { config } from '../../config.js';
import {
  decryptProviderCredentials,
  encryptProviderCredentials,
  maskSecret,
  type ProviderCredentials,
} from './provider-configuration.js';
import {
  findAllProviderConfigs,
  findProviderConfig,
  upsertProviderConfigs,
  type ProviderConfigRow,
  type UpsertProviderConfigInput,
} from './provider-config-repository.js';

/**
 * P11-A — Provider configuration service.
 *
 * Orchestrates encryption, masking, validation and persistence
 * of provider settings stored in MessagingSystemPolicy.
 * This is the single entry-point for provider configuration
 * logic consumed by admin routes (P11-B) and runtime provider
 * resolution (P11-C).
 */

// ---------------------------------------------------------------------------
// Public read types (never expose raw secrets)
// ---------------------------------------------------------------------------

export interface ProviderConfigSummary {
  channel: MessagingChannel;
  displayName: string;
  botUsername: string | null;
  credentialConfigured: boolean;
  botTokenMasked: string | null;
  enabled: boolean;
  notificationEnabled: boolean;
  otpEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

const CHANNEL_LABELS: Partial<Record<string, string>> = {
  TELEGRAM: '\u062a\u0644\u06af\u0631\u0627\u0645',
  BALE: '\u0628\u0644\u0647',
};

/** Readable summaries for System Admin; secrets are masked, never exposed. */
export async function getProviderSummaries(
  channels: readonly MessagingChannel[],
): Promise<ProviderConfigSummary[]> {
  const configs = await findAllProviderConfigs(channels);
  return channels.map((ch) => summarize(ch, configs.get(ch)));
}

/** Readable summary for a single channel. */
export async function getProviderSummary(
  channel: MessagingChannel,
): Promise<ProviderConfigSummary> {
  return summarize(channel, await findProviderConfig(channel));
}

/**
 * Decrypt credentials for internal runtime use only.
 * Never expose the result to API consumers or logs.
 */
export function decryptCredentials(encrypted: string): ProviderCredentials {
  assertMasterKey();
  return decryptProviderCredentials(encrypted, config.messagingCredentialsKey);
}

/** Whether the deployment master key is configured and long enough. */
export function isMasterKeyConfigured(): boolean {
  return config.messagingCredentialsKey.trim().length >= 32;
}

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

export interface SaveProviderConfigInput {
  channel: MessagingChannel;
  displayName: string;
  botUsername: string | null;
  enabled: boolean;
  notificationEnabled: boolean;
  otpEnabled: boolean;
  /** undefined = keep existing; null = clear; string = new token to encrypt. */
  botToken?: string | null;
}

/**
 * Persist provider configurations. Encrypts credentials when present.
 *
 * The caller is responsible for HTTP-boundary validation (Zod parsing,
 * OTP single-select rule, etc.). This method handles encryption and
 * delegates to the repository for transactional persistence.
 */
export async function saveProviderConfigs(
  inputs: SaveProviderConfigInput[],
): Promise<void> {
  const upserts: UpsertProviderConfigInput[] = inputs.map(
    ({ botToken, ...rest }) => {
      let credentialsEncrypted: string | null | undefined;
      if (botToken === undefined) {
        credentialsEncrypted = undefined;
      } else if (botToken === null) {
        credentialsEncrypted = null;
      } else {
        assertMasterKey();
        credentialsEncrypted = encryptProviderCredentials(
          { botToken },
          config.messagingCredentialsKey,
        );
      }
      return { ...rest, credentialsEncrypted };
    },
  );
  await upsertProviderConfigs(upserts);
}

// ---------------------------------------------------------------------------
// Helpers (internal)
// ---------------------------------------------------------------------------

function assertMasterKey(): void {
  if (config.messagingCredentialsKey.trim().length < 32) {
    throw new Error('messaging_credentials_key_missing_or_too_short');
  }
}

function summarize(
  channel: MessagingChannel,
  row: ProviderConfigRow | null | undefined,
): ProviderConfigSummary {
  return {
    channel,
    displayName: row?.displayName ?? CHANNEL_LABELS[channel] ?? channel,
    botUsername: row?.botUsername ?? null,
    credentialConfigured: Boolean(row?.credentialsEncrypted),
    botTokenMasked: maskedToken(row?.credentialsEncrypted ?? null),
    enabled: row?.enabled ?? false,
    notificationEnabled: row?.notificationEnabled ?? false,
    otpEnabled: row?.otpEnabled ?? false,
  };
}

function maskedToken(encrypted: string | null): string | null {
  if (!encrypted || !isMasterKeyConfigured()) return null;
  try {
    const creds = decryptProviderCredentials(
      encrypted,
      config.messagingCredentialsKey,
    );
    return maskSecret(creds.botToken);
  } catch {
    return '\u2022\u2022\u2022\u2022';
  }
}
