import crypto from 'node:crypto';
import { config } from '../../config';

/**
 * P11-A helper for storing provider secrets safely.
 *
 * Provider tokens must never be stored as plain text. The database layer can
 * use this helper when provider management from System Admin is enabled.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  if (!config.messagingCredentialsKey) {
    throw new Error('MESSAGING_CREDENTIALS_KEY is required for provider credentials');
  }

  return crypto
    .createHash('sha256')
    .update(config.messagingCredentialsKey)
    .digest();
}

export function encryptProviderCredential(value: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptProviderCredential(payload: string): string {
  const data = Buffer.from(payload, 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString('utf8');
}
