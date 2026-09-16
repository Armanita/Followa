import { describe, expect, it } from 'vitest';
import {
  decryptProviderCredentials,
  encryptProviderCredentials,
  maskSecret,
} from '../src/modules/messaging/provider-configuration.js';

describe('provider credential protection', () => {
  const key = 'test-only-master-key-with-at-least-32-characters';

  // --- Encryption roundtrip (preserved from initial P11-A) ----------------

  it('encrypts and authenticates provider tokens', () => {
    const encrypted = encryptProviderCredentials({ botToken: 'secret-token-1234' }, key);
    expect(encrypted).not.toContain('secret-token-1234');
    expect(decryptProviderCredentials(encrypted, key)).toEqual({ botToken: 'secret-token-1234' });
    expect(() => decryptProviderCredentials(`${encrypted}x`, key)).toThrow('provider_credentials_invalid');
  });

  it('never exposes more than the last four characters in masked output', () => {
    expect(maskSecret('secret-token-1234')).toBe('\u2022\u2022\u2022\u20221234');
    expect(maskSecret('123')).toBe('\u2022\u2022\u2022\u2022');
  });

  // --- Master key validation ----------------------------------------------

  it('rejects master key shorter than 32 characters', () => {
    expect(() => encryptProviderCredentials({ botToken: 'valid-token' }, 'too-short'))
      .toThrow('messaging_credentials_key_missing_or_too_short');
  });

  it('rejects empty master key', () => {
    expect(() => encryptProviderCredentials({ botToken: 'valid-token' }, ''))
      .toThrow('messaging_credentials_key_missing_or_too_short');
  });

  it('rejects whitespace-only master key', () => {
    expect(() => encryptProviderCredentials({ botToken: 'valid-token' }, '       '))
      .toThrow('messaging_credentials_key_missing_or_too_short');
  });

  // --- Credential validation ----------------------------------------------

  it('rejects empty bot token before encryption', () => {
    expect(() => encryptProviderCredentials({ botToken: '' }, key))
      .toThrow('provider_credentials_invalid');
  });

  it('rejects whitespace-only bot token', () => {
    expect(() => encryptProviderCredentials({ botToken: '   ' }, key))
      .toThrow('provider_credentials_invalid');
  });

  it('trims bot token before encryption', () => {
    const encrypted = encryptProviderCredentials({ botToken: '  real-token  ' }, key);
    expect(decryptProviderCredentials(encrypted, key)).toEqual({ botToken: 'real-token' });
  });

  // --- Encryption integrity -----------------------------------------------

  it('produces different ciphertext for the same input (random IV)', () => {
    const a = encryptProviderCredentials({ botToken: 'same-token' }, key);
    const b = encryptProviderCredentials({ botToken: 'same-token' }, key);
    expect(a).not.toBe(b);
    expect(decryptProviderCredentials(a, key)).toEqual(decryptProviderCredentials(b, key));
  });

  it('includes version prefix in encrypted output', () => {
    const encrypted = encryptProviderCredentials({ botToken: 'token' }, key);
    expect(encrypted.startsWith('v1.')).toBe(true);
    expect(encrypted.split('.').length).toBe(4);
  });

  it('rejects decryption with wrong key', () => {
    const encrypted = encryptProviderCredentials({ botToken: 'token' }, key);
    const wrongKey = 'different-master-key-with-at-least-32-characters';
    expect(() => decryptProviderCredentials(encrypted, wrongKey))
      .toThrow('provider_credentials_invalid');
  });

  it('rejects tampered ciphertext', () => {
    const encrypted = encryptProviderCredentials({ botToken: 'token' }, key);
    const parts = encrypted.split('.');
    parts[3] = parts[3].slice(0, -2) + 'XX';
    expect(() => decryptProviderCredentials(parts.join('.'), key))
      .toThrow('provider_credentials_invalid');
  });

  it('rejects tampered auth tag', () => {
    const encrypted = encryptProviderCredentials({ botToken: 'token' }, key);
    const parts = encrypted.split('.');
    parts[2] = parts[2].slice(0, -2) + 'XX';
    expect(() => decryptProviderCredentials(parts.join('.'), key))
      .toThrow('provider_credentials_invalid');
  });

  it('rejects malformed encrypted values', () => {
    expect(() => decryptProviderCredentials('not-valid', key)).toThrow('provider_credentials_invalid');
    expect(() => decryptProviderCredentials('v2.a.b.c', key)).toThrow('provider_credentials_invalid');
    expect(() => decryptProviderCredentials('', key)).toThrow('provider_credentials_invalid');
    expect(() => decryptProviderCredentials('v1.a.b.c.d', key)).toThrow('provider_credentials_invalid');
  });

  // --- Masking edge cases -------------------------------------------------

  it('masks empty string', () => {
    expect(maskSecret('')).toBe('\u2022\u2022\u2022\u2022');
  });

  it('masks exactly four characters without revealing any', () => {
    expect(maskSecret('1234')).toBe('\u2022\u2022\u2022\u2022');
  });

  it('masks five characters showing only the last four', () => {
    expect(maskSecret('12345')).toBe('\u2022\u2022\u2022\u20222345');
  });

  it('masks long tokens consistently', () => {
    const long = 'a'.repeat(200) + 'WXYZ';
    expect(maskSecret(long)).toBe('\u2022\u2022\u2022\u2022WXYZ');
  });
});
