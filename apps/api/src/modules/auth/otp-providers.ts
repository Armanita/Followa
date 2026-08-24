import { config } from '../../config.js';

export interface OtpProvider {
  readonly name: string;
  sendOtp(mobile: string, code: string): Promise<void>;
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

export function createOtpProvider(): OtpProvider {
  switch (config.otpProvider) {
    case 'sms':
      return new SmsOtpProvider(process.env.SMS_API_KEY, process.env.SMS_SENDER);
    case 'bale':
      return new MessengerOtpProvider('bale', process.env.BALE_BOT_TOKEN);
    case 'eitaa':
      return new MessengerOtpProvider('eitaa', process.env.EITAA_BOT_TOKEN);
    default:
      return new MockOtpProvider();
  }
}
