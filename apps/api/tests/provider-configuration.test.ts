import { describe, expect, it } from 'vitest';
import {
  decryptProviderCredentials,
  encryptProviderCredentials,
  maskSecret,
} from '../src/modules/messaging/provider-configuration.js';

describe('provider credential protection', () => {
  const key = 'test-only-master-key-with-at-least-32-characters';

  it('encrypts and authenticates provider tokens', () => {
    const encrypted = encryptProviderCredentials({ botToken: 'secret-token-1234' }, key);
    expect(encrypted).not.toContain('secret-token-1234');
    expect(decryptProviderCredentials(encrypted, key)).toEqual({ botToken: 'secret-token-1234' });
    expect(() => decryptProviderCredentials(`${encrypted}x`, key)).toThrow('provider_credentials_invalid');
  });

  it('never exposes more than the last four characters in masked output', () => {
    expect(maskSecret('secret-token-1234')).toBe('••••1234');
    expect(maskSecret('123')).toBe('••••');
  });
});
