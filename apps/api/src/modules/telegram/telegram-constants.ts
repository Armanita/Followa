export const TELEGRAM_COMMANDS = {
  START: '/start',
  HELP: '/help',
  LOGIN: '/login',
} as const;

export const TELEGRAM_MESSAGES = {
  REQUEST_CONTACT:
    'برای اتصال حساب Followa لطفاً شماره موبایل خود را ارسال کنید.',
  UNKNOWN_USER:
    'این شماره در Followa ثبت نشده است. در صورت عضویت با مدیر سازمان خود تماس بگیرید.',
  CONNECTED:
    'حساب Followa شما با موفقیت به تلگرام متصل شد.',
} as const;
