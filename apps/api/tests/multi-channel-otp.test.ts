import { MessagingChannel } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { createSelectedChannelOtpProvider } from '../src/modules/messaging/otp-dispatcher.js';

function fixture(options: {
  channel?: MessagingChannel | null;
  active?: boolean;
  systemEnabled?: boolean;
  otpEnabled?: boolean;
  telegramDestination?: string | null;
  baleDestination?: string | null;
  credentialsEncrypted?: string | null;
  multiplePolicies?: boolean;
} = {}) {
  const channel = options.channel === undefined ? MessagingChannel.TELEGRAM : options.channel;
  const telegramSend = vi.fn(async () => undefined);
  const baleSend = vi.fn(async () => undefined);
  const credentialsEncrypted = options.credentialsEncrypted === undefined ? 'encrypted' : options.credentialsEncrypted;
  const db = {
    user: { findUnique: vi.fn(async () => ({ id: 'user-1' })) },
    companyMembership: {
      findFirst: vi.fn(async () => options.active === false ? null : { id: 'membership-1' }),
    },
    userMessagingPreference: {
      findUnique: vi.fn(async () => channel === null ? null : { otpChannel: channel }),
    },
    messagingSystemPolicy: {
      count: vi.fn(async () => channel === null ? 0 : 1),
      findMany: vi.fn(async () => {
        if (options.multiplePolicies) {
          return [
            { channel: MessagingChannel.TELEGRAM, enabled: true, otpEnabled: true, credentialsEncrypted: 'encrypted' },
            { channel: MessagingChannel.BALE, enabled: true, otpEnabled: true, credentialsEncrypted: 'encrypted' },
          ];
        }
        if (channel === null) return [];
        return [{ channel, enabled: options.systemEnabled ?? true, otpEnabled: options.otpEnabled ?? true, credentialsEncrypted }];
      }),
      findUnique: vi.fn(async () => ({ enabled: options.systemEnabled ?? true, otpEnabled: options.otpEnabled ?? true, credentialsEncrypted })),
    },
    messagingIdentity: {
      findUnique: vi.fn(async (query: { where?: { userId_channel?: { channel?: MessagingChannel } } }) => {
        const requested = query.where?.userId_channel?.channel;
        if (requested === MessagingChannel.TELEGRAM) {
          return options.telegramDestination === null ? null : { id: 'telegram-identity-1', userId: 'user-1', externalUserId: 'telegram-user-1', destinationId: options.telegramDestination ?? 'telegram-1', status: 'ACTIVE', verifiedAt: new Date(), version: 1 };
        }
        if (requested === MessagingChannel.BALE) {
          return options.baleDestination === null ? null : { externalUserId: 'bale-user-1', destinationId: options.baleDestination ?? 'bale-chat-1', status: 'ACTIVE', verifiedAt: new Date() };
        }
        return null;
      }),
    },
  };
  const provider = createSelectedChannelOtpProvider(
    db as never,
    { telegram: { name: 'telegram', send: telegramSend }, bale: { name: 'bale', send: baleSend } } as never,
  );
  return { provider, telegramSend, baleSend, db };
}

describe('selected OTP channel', () => {
  it('sends activation OTP only to the selected Telegram identity', async () => {
    const { provider, telegramSend, baleSend } = fixture();
    await provider.sendOtp('09120000001', '123456', 'ACTIVATION');
    expect(telegramSend).toHaveBeenCalledTimes(1);
    expect(telegramSend).toHaveBeenCalledWith(expect.objectContaining({ destination: 'telegram-1', text: expect.stringContaining('123456') }));
    expect(baleSend).not.toHaveBeenCalled();
  });
  it('sends password-reset OTP only to a verified active Bale identity', async () => {
    const { provider, telegramSend, baleSend } = fixture({ channel: MessagingChannel.BALE });
    await provider.sendOtp('09120000001', '654321', 'PASSWORD_RESET');
    expect(baleSend).toHaveBeenCalledTimes(1);
    expect(baleSend).toHaveBeenCalledWith(expect.objectContaining({ destination: 'bale-chat-1' }));
    expect(telegramSend).not.toHaveBeenCalled();
  });
  it('no policy does not fallback to legacy provider', async () => {
    const { provider, telegramSend, baleSend } = fixture({ channel: null });
    await expect(provider.sendOtp('09120000001', '112233', 'ACTIVATION')).rejects.toThrow(/otp_channel_unavailable/);
    expect(telegramSend).not.toHaveBeenCalled();
    expect(baleSend).not.toHaveBeenCalled();
  });
  it('OTP fails closed without selected channel', async () => {
    const { provider, telegramSend, baleSend } = fixture({ channel: null, telegramDestination: null });
    await expect(provider.sendOtp('09120000001', '334455', 'ACTIVATION')).rejects.toThrow(/otp_channel_unavailable/);
    expect(telegramSend).not.toHaveBeenCalled();
    expect(baleSend).not.toHaveBeenCalled();
  });
  it('fails closed when multiple policies are enabled', async () => {
    const { provider, telegramSend, baleSend } = fixture({ channel: null, multiplePolicies: true });
    await expect(provider.sendOtp('09120000001', '556677', 'ACTIVATION')).rejects.toThrow(/otp_channel_unavailable/);
    expect(telegramSend).not.toHaveBeenCalled();
    expect(baleSend).not.toHaveBeenCalled();
  });
  it('fails closed when credentials are missing', async () => {
    const { provider, telegramSend, baleSend } = fixture({ channel: null, credentialsEncrypted: null });
    // Need to have no user preference but single policy with missing credentials - use null channel and override to have one policy with null creds
    // Our fixture with channel null returns [] for findMany, so we need a custom case: use a channel but no credentials
    const custom = fixture({ channel: MessagingChannel.TELEGRAM, credentialsEncrypted: null });
    await expect(custom.provider.sendOtp('09120000001', '778899', 'ACTIVATION')).rejects.toThrow(/otp_channel_unavailable/);
    expect(telegramSend).not.toHaveBeenCalled();
    expect(baleSend).not.toHaveBeenCalled();
  });
  it('fails closed when no identity exists', async () => {
    const { provider, telegramSend, baleSend } = fixture({ channel: MessagingChannel.TELEGRAM, telegramDestination: null });
    await expect(provider.sendOtp('09120000001', '990011', 'ACTIVATION')).rejects.toThrow(/otp_channel_unavailable/);
    expect(telegramSend).not.toHaveBeenCalled();
    expect(baleSend).not.toHaveBeenCalled();
  });
  it.each([
    ['inactive company or membership', { active: false }],
    ['disabled system channel', { systemEnabled: false }],
    ['OTP-disabled system channel', { otpEnabled: false }],
    ['missing selected identity', { telegramDestination: null }],
  ])('fails closed for %s without another-channel fallback', async (_label, options) => {
    const { provider, telegramSend, baleSend } = fixture(options as any);
    await expect(provider.sendOtp('09120000001', '998877', 'ACTIVATION')).rejects.toThrow(/otp_(recipient|channel)_unavailable/);
    expect(telegramSend).not.toHaveBeenCalled();
    expect(baleSend).not.toHaveBeenCalled();
  });
  it('does not fall back after the selected provider fails', async () => {
    const { provider, telegramSend, baleSend } = fixture();
    telegramSend.mockRejectedValueOnce(new Error('provider_down'));
    await expect(provider.sendOtp('09120000001', '445566')).rejects.toThrow('provider_down');
    expect(baleSend).not.toHaveBeenCalled();
  });
});
