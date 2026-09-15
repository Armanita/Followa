import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export type ProviderCredentials = {
  botToken: string;
};

const FORMAT = 'v1';

function keyFrom(secret: string): Buffer {
  if (secret.trim().length < 32) {
    throw new Error('messaging_credentials_key_missing_or_too_short');
  }
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function encryptProviderCredentials(
  credentials: ProviderCredentials,
  secret: string,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(credentials), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [FORMAT, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptProviderCredentials(
  value: string,
  secret: string,
): ProviderCredentials {
  const [version, ivValue, tagValue, ciphertextValue, extra] = value.split('.');
  if (version !== FORMAT || !ivValue || !tagValue || !ciphertextValue || extra) {
    throw new Error('provider_credentials_invalid');
  }
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      keyFrom(secret),
      Buffer.from(ivValue, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    const decoded = Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
    const credentials = JSON.parse(decoded) as Partial<ProviderCredentials>;
    if (typeof credentials.botToken !== 'string' || !credentials.botToken.trim()) {
      throw new Error('provider_credentials_invalid');
    }
    return { botToken: credentials.botToken };
  } catch (error) {
    if (error instanceof Error && error.message === 'messaging_credentials_key_missing_or_too_short') throw error;
    throw new Error('provider_credentials_invalid');
  }
}

export function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return '••••';
  return `••••${trimmed.slice(-4)}`;
}
