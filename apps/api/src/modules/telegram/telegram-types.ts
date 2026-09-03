export type TelegramUserPayload = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

export type TelegramContactPayload = {
  phone_number: string;
  user_id?: number;
};

export type TelegramWebhookUpdate = {
  update_id: number;
  message?: {
    text?: string;
    from?: TelegramUserPayload;
    contact?: TelegramContactPayload;
  };
};

export type TelegramIdentityStatus = 'PENDING' | 'CONNECTED' | 'DISCONNECTED';
