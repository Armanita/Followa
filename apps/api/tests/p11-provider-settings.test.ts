import { describe, expect, it } from 'vitest';
import { decryptProviderCredentials, encryptProviderCredentials, maskSecret } from '../src/modules/messaging/provider-configuration.js';
import { parseSystemProviderBody } from '../src/modules/messaging/provider-policy-validation.js';

describe('P11 provider settings', () => {
  const base = (extra: Record<string, unknown> = {}) => ({ channel: 'TELEGRAM', enabled: true, notificationEnabled: true, otpEnabled: false, displayName: 'تلگرام', botUsername: null, botToken: 'secret-token-1234', ...extra });
  it('validates one and only one OTP channel', () => {
    expect(() => parseSystemProviderBody({ channels: [base({ channel: 'TELEGRAM', otpEnabled: true }), base({ channel: 'BALE', displayName: 'بله', otpEnabled: true })] })).toThrow();
    expect(parseSystemProviderBody({ channels: [base({ channel: 'TELEGRAM', otpEnabled: true }), base({ channel: 'BALE', displayName: 'بله' })] }).channels).toHaveLength(2);
  });
  it('allows notification on both channels but not on a disabled channel', () => {
    expect(parseSystemProviderBody({ channels: [base(), base({ channel: 'BALE', displayName: 'بله', notificationEnabled: true })] })).toBeTruthy();
    expect(() => parseSystemProviderBody({ channels: [base({ enabled: false }), base({ channel: 'BALE', displayName: 'بله' })] })).toThrow();
  });
  it('round-trips encrypted credentials without exposing the token', () => {
    const key = 'test-only-master-key-with-at-least-32-characters';
    const encrypted = encryptProviderCredentials({ botToken: 'secret-token-1234' }, key);
    expect(encrypted).not.toContain('secret-token-1234');
    expect(decryptProviderCredentials(encrypted, key).botToken).toBe('secret-token-1234');
    expect(maskSecret('secret-token-1234')).toBe('••••1234');
  });
});
