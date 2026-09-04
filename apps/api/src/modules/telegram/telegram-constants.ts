export const TELEGRAM_COMMANDS = {
  START: '/start',
  HELP: '/help',
  LOGIN: '/login',
} as const;

export const TELEGRAM_MESSAGES = {
  REQUEST_CONTACT: 'برای اتصال حساب، شماره موبایل خود را ارسال کنید.',
  USER_NOT_FOUND: 'کاربری با این شماره در Followa پیدا نشد.',
  CONNECTED: 'حساب تلگرام شما با موفقیت متصل شد.',
} as const;
