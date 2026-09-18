import type { MessagingChannel } from '@prisma/client';
import { config } from '../../config.js';
import { decryptProviderCredentials, encryptProviderCredentials, maskSecret, type ProviderCredentials } from './provider-configuration.js';
import { findAllProviderConfigs, findProviderConfig, upsertProviderConfigs, type ProviderConfigRow, type UpsertProviderConfigInput } from './provider-config-repository.js';

export interface ProviderConfigSummary { channel: MessagingChannel; displayName: string; botUsername: string | null; credentialConfigured: boolean; botTokenMasked: string | null; webhookSecretMasked: string | null; enabled: boolean; notificationEnabled: boolean; otpEnabled: boolean; }
export interface RuntimeProviderConfig { channel: MessagingChannel; displayName: string; botUsername: string | null; botToken: string; webhookSecret: string | null; enabled: boolean; notificationEnabled: boolean; otpEnabled: boolean; }
const CHANNEL_LABELS: Partial<Record<string, string>> = { TELEGRAM: 'تلگرام', BALE: 'بله' };

export async function getProviderSummaries(channels: readonly MessagingChannel[]): Promise<ProviderConfigSummary[]> { const configs = await findAllProviderConfigs(channels); return channels.map((ch) => summarize(ch, configs.get(ch))); }
export async function getProviderSummary(channel: MessagingChannel): Promise<ProviderConfigSummary> { return summarize(channel, await findProviderConfig(channel)); }
export function decryptCredentials(encrypted: string): ProviderCredentials { assertMasterKey(); return decryptProviderCredentials(encrypted, config.messagingCredentialsKey); }
export async function getRuntimeProviderConfig(channel: MessagingChannel): Promise<RuntimeProviderConfig | null> { const row = await findProviderConfig(channel); if (!row?.enabled || !row.credentialsEncrypted) return null; try { const credentials = decryptCredentials(row.credentialsEncrypted); return { channel: row.channel, displayName: row.displayName ?? CHANNEL_LABELS[channel] ?? channel, botUsername: row.botUsername, botToken: credentials.botToken, webhookSecret: credentials.webhookSecret ?? null, enabled: row.enabled, notificationEnabled: row.notificationEnabled, otpEnabled: row.otpEnabled }; } catch { return null; } }
export async function getTelegramRuntimeConfig(): Promise<RuntimeProviderConfig | null> {
  const dbConfig = await getRuntimeProviderConfig('TELEGRAM' as MessagingChannel);
  if (dbConfig) return dbConfig;
  // Bootstrap fallback: use ENV if DB not yet configured (admin has not saved)
  if (config.telegramBotToken.trim() && config.telegramWebhookSecret.trim()) {
    return {
      channel: 'TELEGRAM' as MessagingChannel,
      displayName: 'تلگرام',
      botUsername: config.telegramBotUsername || null,
      botToken: config.telegramBotToken.trim(),
      webhookSecret: config.telegramWebhookSecret.trim(),
      enabled: true,
      notificationEnabled: true,
      otpEnabled: true,
    };
  }
  return null;
}
export async function getTelegramWebhookSecret(): Promise<string | null> {
  const cfg = await getTelegramRuntimeConfig();
  return cfg?.webhookSecret ?? null;
}
export async function getTelegramBotToken(): Promise<string | null> {
  const cfg = await getTelegramRuntimeConfig();
  return cfg?.botToken ?? null;
}
export function isMasterKeyConfigured(): boolean { return config.messagingCredentialsKey.trim().length >= 32; }
export interface SaveProviderConfigInput { channel: MessagingChannel; displayName: string; botUsername: string | null; enabled: boolean; notificationEnabled: boolean; otpEnabled: boolean; botToken?: string | null; webhookSecret?: string | null; }
export async function saveProviderConfigs(inputs: SaveProviderConfigInput[]): Promise<void> {
  const upserts: UpsertProviderConfigInput[] = await Promise.all(
    inputs.map(async ({ botToken, webhookSecret, ...rest }) => {
      let credentialsEncrypted: string | null | undefined;
      const hasBotToken = botToken !== undefined;
      const hasWebhookSecret = webhookSecret !== undefined;
      if (!hasBotToken && !hasWebhookSecret) {
        credentialsEncrypted = undefined;
      } else if (botToken === null) {
        credentialsEncrypted = null;
      } else {
        assertMasterKey();
        // Merge with existing credentials if only one field is updated
        let existing: ProviderCredentials = { botToken: '' };
        if (hasBotToken && botToken !== null) {
          existing.botToken = botToken.trim();
        } else if (hasWebhookSecret) {
          const row = await findProviderConfig(rest.channel);
          if (row?.credentialsEncrypted) {
            try {
              existing = decryptCredentials(row.credentialsEncrypted);
            } catch {}
          }
          if (!existing.botToken) throw new Error('provider_credentials_invalid');
        }
        if (hasWebhookSecret) {
          if (webhookSecret === null) existing.webhookSecret = null;
          else if (webhookSecret.trim()) existing.webhookSecret = webhookSecret.trim();
          else existing.webhookSecret = null;
        } else if (!hasBotToken) {
          // Only webhookSecret provided, keep existing botToken
          const row = await findProviderConfig(rest.channel);
          if (row?.credentialsEncrypted) {
            try {
              const dec = decryptCredentials(row.credentialsEncrypted);
              existing.botToken = dec.botToken;
              if (dec.webhookSecret) existing.webhookSecret = dec.webhookSecret;
            } catch {}
          }
        }
        if (hasBotToken && botToken !== null) existing.botToken = botToken.trim();
        credentialsEncrypted = encryptProviderCredentials(existing, config.messagingCredentialsKey);
      }
      return { ...rest, credentialsEncrypted };
    }),
  );
  await upsertProviderConfigs(upserts);
}
function assertMasterKey(): void { if (config.messagingCredentialsKey.trim().length < 32) throw new Error('messaging_credentials_key_missing_or_too_short'); }
function summarize(channel: MessagingChannel, row: ProviderConfigRow | null | undefined): ProviderConfigSummary {
  return {
    channel,
    displayName: row?.displayName ?? CHANNEL_LABELS[channel] ?? channel,
    botUsername: row?.botUsername ?? null,
    credentialConfigured: Boolean(row?.credentialsEncrypted),
    botTokenMasked: maskedToken(row?.credentialsEncrypted ?? null),
    webhookSecretMasked: maskedWebhookSecret(row?.credentialsEncrypted ?? null),
    enabled: row?.enabled ?? false,
    notificationEnabled: row?.notificationEnabled ?? false,
    otpEnabled: row?.otpEnabled ?? false,
  };
}
function maskedToken(encrypted: string | null): string | null { if (!encrypted || !isMasterKeyConfigured()) return null; try { return maskSecret(decryptProviderCredentials(encrypted, config.messagingCredentialsKey).botToken); } catch { return '••••'; } }
function maskedWebhookSecret(encrypted: string | null): string | null {
  if (!encrypted || !isMasterKeyConfigured()) return null;
  try {
    const secret = decryptProviderCredentials(encrypted, config.messagingCredentialsKey).webhookSecret;
    return secret ? maskSecret(secret) : null;
  } catch { return '••••'; }
}
