import { config } from '../../config.js';
import { prisma } from '../../lib/prisma.js';
import type { TelegramReplyMarkup } from '../telegram/telegram-client.js';
import type { MessagingProvider } from '../messaging/messaging-types.js';
import {
  getTelegramProvider,
  TelegramProvider,
} from '../messaging/providers/telegram-provider.js';
import { createTelegramRepository } from '../telegram/telegram-repository.js';

export type OtpDeliveryPurpose = 'ACTIVATION' | 'PASSWORD_RESET';

export interface OtpProvider {
  readonly name: string;
  sendOtp(
    mobile: string,
    code: string,
    ...context: [purpose?: OtpDeliveryPurpose]
  ): Promise<void>;
}

/**
 * Mock provider — logs the code. Used in development; swap via OTP_PROVIDER env.
 * Real adapters below keep the same interface so production wiring is a
 * configuration change, not a refactor.
 */
class MockOtpProvider implements OtpProvider {
  readonly name = 'mock';

  async sendOtp(mobile: string, code: string): Promise<void> {
    console.log(`[otp:mock] code for ${mobile}: ${code}`);
  }
}

class SmsOtpProvider implements OtpProvider {
  readonly name = 'sms';
  constructor(
    private apiKey: string | undefined,
    private sender: string | undefined,
  ) {}

  async sendOtp(mobile: string, code: string): Promise<void> {
    // Adapter for Iranian SMS gateways (e.g. Kavenegar/SMS.ir). Requires API key.
    if (!this.apiKey) throw new Error('SMS provider not configured');
    console.log(`[otp:sms] would POST to gateway: to=${mobile} text="کد ورود: ${code}"`);
  }
}

class MessengerOtpProvider implements OtpProvider {
  readonly name: string;
  constructor(
    private platform: 'bale' | 'eitaa',
    private token: string | undefined,
  ) {
    this.name = platform;
  }

  async sendOtp(mobile: string, code: string): Promise<void> {
    if (!this.token) throw new Error(`${this.platform} provider not configured`);
    console.log(
      `[otp:${this.platform}] would send message to ${mobile}: کد ورود شما ${code}`,
    );
  }
}

/**
 * Telegram OTP provider — delivery channel ONLY.
 *
 * The Telegram account is exclusively the destination where the one-time code
 * is sent. It is never an authentication credential: no JWT is issued from
 * Telegram, no callback/message authenticates anyone, and the code is only
 * ever verified by the normal Followa API endpoints.
 *
 * Resolution: mobile → Followa user → TelegramIdentity → telegramUserId.
 * Dependencies are injectable (same pattern as createTelegramService) so the
 * provider is testable without Telegram network access.
 */
type TelegramOtpRepository = {
  findUserByMobile(mobile: string): Promise<{ id: string; mobile: string } | null>;
  findIdentityByUserId(userId: string): Promise<{ telegramUserId: string; userId: string } | null>;
};
type TelegramOtpClient = {
  sendMessage(
    chatId: number | string,
    text: string,
    replyMarkup?: TelegramReplyMarkup,
  ): Promise<unknown>;
};

export class TelegramOtpProvider implements OtpProvider {
  readonly name = 'telegram';
  constructor(
    private readonly repository: TelegramOtpRepository = createTelegramRepository(prisma),
    private readonly provider: MessagingProvider = getTelegramProvider(),
  ) {}

  private async sendTelegram(
    destination: string,
    text: string,
    replyMarkup?: TelegramReplyMarkup,
  ): Promise<void> {
    await this.provider.send({
      destination,
      text,
      ...(replyMarkup ? { metadata: { replyMarkup } } : {}),
    });
  }

  async sendOtp(
    mobile: string,
    code: string,
    ...context: [purpose?: OtpDeliveryPurpose]
  ): Promise<void> {
    const [purpose] = context;
    const user = await this.repository.findUserByMobile(mobile);
    if (!user) {
      throw new Error('telegram_otp_user_not_found');
    }
    const identity = await this.repository.findIdentityByUserId(user.id);
    if (!identity) {
      // No linked Telegram account — cannot deliver. Fail loudly so the
      // caller knows delivery did not happen (OTP state is rolled back).
      throw new Error('telegram_otp_identity_not_linked');
    }

    if (purpose === 'ACTIVATION') {
      await this.sendTelegram(
        identity.telegramUserId,
        `🔐 کد فعال‌سازی فالوآ\n\nکد یکبارمصرف شما:\n\n${code}\n\n⏱ اعتبار کد: ۵ دقیقه\n🔒 این کد را در اختیار دیگران قرار ندهید.`,
        {
          inline_keyboard: [
            [
              {
                text: '📋 کپی کد',
                copy_text: { text: code },
              },
            ],
          ],
        },
      );
      return;
    }

    if (purpose === 'PASSWORD_RESET') {
      await this.sendTelegram(
        identity.telegramUserId,
        `🔑 بازیابی رمز عبور فالوآ\n\nکد تأیید شما:\n\n${code}\n\n⏱ اعتبار کد: ۵ دقیقه\n🔒 این کد را در اختیار دیگران قرار ندهید.`,
        {
          inline_keyboard: [
            [
              {
                text: '📋 کپی کد',
                copy_text: { text: code },
              },
            ],
          ],
        },
      );
      return;
    }

    await this.sendTelegram(
      identity.telegramUserId,
      `کد یکبارمصرف فالوآ: ${code}\nمدت اعتبار: ۵ دقیقه`,
    );
  }
}

export function createOtpProvider(): OtpProvider {
  switch (config.otpProvider) {
    case 'sms':
      return new SmsOtpProvider(process.env.SMS_API_KEY, process.env.SMS_SENDER);
    case 'bale':
      return new MessengerOtpProvider('bale', process.env.BALE_BOT_TOKEN);
    case 'eitaa':
      return new MessengerOtpProvider('eitaa', process.env.EITAA_BOT_TOKEN);
    case 'telegram':
      return new TelegramOtpProvider();
    default:
      return new MockOtpProvider();
  }
}

/** Exposed for tests: instantiates the Telegram provider with fakes, no network. */
export function createTelegramOtpProviderForTests(
  repository: TelegramOtpRepository,
  client: TelegramOtpClient,
): OtpProvider {
  return new TelegramOtpProvider(repository, new TelegramProvider(client));
}
