import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? '0.0.0.0',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  jwtSecret: required('JWT_SECRET', 'dev-only-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  otpProvider: process.env.OTP_PROVIDER ?? 'mock',
  notificationProvider: process.env.NOTIFICATION_PROVIDER ?? 'mock',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME ?? '',
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? '',
  storageDir: process.env.STORAGE_DIR ?? './storage/files',
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB ?? 20),
  databaseUrl: required(
    'DATABASE_URL',
    'postgresql://followa:followa_dev_password@localhost:5433/followa?schema=public',
  ),
};
