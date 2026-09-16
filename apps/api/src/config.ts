import 'dotenv/config';
function required(name: string, fallback?: string): string { const value = process.env[name] ?? fallback; if (value === undefined) throw new Error(`Missing required environment variable: ${name}`); return value; }
const enabled = (name: string) => process.env[name]?.trim().toLowerCase() === 'true';
export const config = {
  port: Number(process.env.PORT ?? 3001), host: process.env.HOST ?? '0.0.0.0', nodeEnv: process.env.NODE_ENV ?? 'development',
  jwtSecret: required('JWT_SECRET', 'dev-only-secret-change-me'), jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  messagingCredentialsKey: process.env.MESSAGING_CREDENTIALS_KEY ?? '',
  otpProvider: process.env.OTP_PROVIDER ?? 'mock', notificationProvider: process.env.NOTIFICATION_PROVIDER ?? 'mock',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '', telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME ?? '', telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? '',
  baleBotToken: process.env.BALE_BOT_TOKEN ?? '', baleBotUsername: process.env.BALE_BOT_USERNAME ?? '', baleWebhookSecret: process.env.BALE_WEBHOOK_SECRET ?? '',
  baleLinkingEnabled: enabled('BALE_LINKING_ENABLED'), messagingIdentityDualWriteEnabled: enabled('MESSAGING_IDENTITY_DUAL_WRITE_ENABLED'), messagingIdentityBackfillEnabled: enabled('MESSAGING_IDENTITY_BACKFILL_ENABLED'),
  // P10's generic identity model is now authoritative; no rollout flag is read.
  messagingIdentityReadEnabled: true,
  notificationWorkerPollMs: Number(process.env.NOTIFICATION_WORKER_POLL_MS ?? 2000), notificationWorkerLeaseMs: Number(process.env.NOTIFICATION_WORKER_LEASE_MS ?? 30000), notificationMaxAttempts: Number(process.env.NOTIFICATION_MAX_ATTEMPTS ?? 5),
  storageDir: process.env.STORAGE_DIR ?? './storage/files', maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB ?? 20),
  databaseUrl: required('DATABASE_URL', 'postgresql://followa:followa_dev_password@localhost:5433/followa?schema=public'),
};
