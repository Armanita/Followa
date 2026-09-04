export type TelegramIdentityStatus = 'PENDING' | 'CONNECTED' | 'BLOCKED';

export type TelegramUserPayload = {
  telegramUserId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
};

export type TelegramContactPayload = TelegramUserPayload & {
  phoneNumber: string;
};

export type TelegramWebhookUpdate = {
  message?: {
    from?: {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
    text?: string;
    contact?: {
      phone_number: string;
    };
  };
};
