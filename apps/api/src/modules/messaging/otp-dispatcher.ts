import { MessagingChannel, type PrismaClient } from '@prisma/client';
import { config } from '../../config.js';
import type { MessagingProvider } from './messaging-types.js';
import { findOperationalTelegramIdentityByUserId } from './messaging-repository.js';
import { resolveOtpPolicy } from './messaging-policy.js';

export type OtpDispatchPurpose = 'ACTIVATION' | 'PASSWORD_RESET';

export type LegacyOtpProvider = {
  readonly name: string;
  sendOtp(mobile: string, code: string, purpose?: OtpDispatchPurpose): Promise<void>;
};

type OtpDatabase = Pick<
  PrismaClient,
  | 'user'
  | 'companyMembership'
  | 'userMessagingPreference'
  | 'messagingSystemPolicy'
  | 'telegramIdentity'
  | 'messagingIdentity'
>;

type OtpProviders = Readonly<{
  telegram: MessagingProvider;
  bale: MessagingProvider;
}>;

function otpText(code: string, purpose?: OtpDispatchPurpose): string {
  if (purpose === 'ACTIVATION') {
    return `🔐 کد فعال‌سازی فالوآ\n\nکد یکبارمصرف شما:\n\n${code}\n\n⏱ اعتبار کد: ۵ دقیقه\n🔒 این کد را در اختیار دیگران قرار ندهید.`;
  }
  if (purpose === 'PASSWORD_RESET') {
    return `🔑 بازیابی رمز عبور فالوآ\n\nکد تأیید شما:\n\n${code}\n\n⏱ اعتبار کد: ۵ دقیقه\n🔒 این کد را در اختیار دیگران قرار ندهید.`;
  }
  return `کد یکبارمصرف فالوآ: ${code}\nمدت اعتبار: ۵ دقیقه`;
}

/**
 * Routes an OTP to exactly one user-selected channel.
 *
 * A missing preference deliberately uses the existing provider so passwordless
 * users can bootstrap before they can open settings. Once a preference exists,
 * failure is fail-closed: there is no cross-channel fallback or queue/retry.
 */
export class SelectedChannelOtpProvider implements LegacyOtpProvider {
  readonly name = 'selected-channel';

  constructor(
    private readonly db: OtpDatabase,
    private readonly legacyProvider: LegacyOtpProvider,
    private readonly providers: OtpProviders,
  ) {}

  async sendOtp(
    mobile: string,
    code: string,
    purpose?: OtpDispatchPurpose,
  ): Promise<void> {
    const user = await this.db.user.findUnique({
      where: { mobile },
      select: { id: true },
    });
    if (!user) throw new Error('otp_recipient_unavailable');

    // Defense in depth: eligibility is checked again immediately before send.
    const membership = await this.db.companyMembership.findFirst({
      where: { userId: user.id, isActive: true, company: { isActive: true } },
      select: { id: true },
    });
    if (!membership) throw new Error('otp_recipient_unavailable');

    const preference = await this.db.userMessagingPreference.findUnique({
      where: { userId: user.id },
      select: { otpChannel: true },
    });
    const channel = preference?.otpChannel;

    // Bootstrap compatibility is a default, not a failure fallback.
    if (!channel) {
      await this.legacyProvider.sendOtp(mobile, code, purpose);
      return;
    }

    if (channel !== MessagingChannel.TELEGRAM && channel !== MessagingChannel.BALE) {
      throw new Error('otp_channel_unavailable');
    }

    const systemPolicy = await this.db.messagingSystemPolicy.findUnique({
      where: { channel },
      select: { enabled: true, otpEnabled: true },
    });
    if (!resolveOtpPolicy({
      systemEnabled: systemPolicy?.enabled ?? false,
      systemOtpEnabled: systemPolicy?.otpEnabled ?? false,
    }).enabled) {
      throw new Error('otp_channel_unavailable');
    }

    let destination: string | null = null;
    if (channel === MessagingChannel.TELEGRAM) {
      const identity = await findOperationalTelegramIdentityByUserId(
        this.db,
        user.id,
        config.messagingIdentityReadEnabled,
      );
      destination = identity?.telegramUserId ?? null;
    } else {
      const identity = await this.db.messagingIdentity.findUnique({
        where: { userId_channel: { userId: user.id, channel } },
        select: {
          externalUserId: true,
          destinationId: true,
          status: true,
          verifiedAt: true,
        },
      });
      if (identity?.status === 'ACTIVE' && identity.verifiedAt) {
        destination = identity.destinationId ?? identity.externalUserId;
      }
    }

    if (!destination) throw new Error('otp_channel_unavailable');
    const provider = channel === MessagingChannel.TELEGRAM
      ? this.providers.telegram
      : this.providers.bale;
    await provider.send({
      destination,
      text: otpText(code, purpose),
      ...(channel === MessagingChannel.TELEGRAM && purpose
        ? {
            metadata: {
              replyMarkup: {
                inline_keyboard: [[{
                  text: '📋 کپی کد',
                  copy_text: { text: code },
                }]],
              },
            },
          }
        : {}),
    });
  }
}

export function createSelectedChannelOtpProvider(
  db: OtpDatabase,
  legacyProvider: LegacyOtpProvider,
  providers: OtpProviders,
): LegacyOtpProvider {
  return new SelectedChannelOtpProvider(db, legacyProvider, providers);
}
