export type TelegramStartPayload = {
  telegramUserId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
};

export type TelegramContactPayload = TelegramStartPayload & {
  phoneNumber: string;
};

function normalizePhone(phone: string) {
  return phone.replace(/\s+/g, '').replace(/^\+98/, '0');
}

export function createTelegramService() {
  return {
    handleStart(payload: TelegramStartPayload) {
      return {
        status: 'received',
        action: 'request_contact',
        telegramUserId: payload.telegramUserId,
      };
    },

    handleContact(payload: TelegramContactPayload) {
      return {
        status: 'received',
        action: 'identity_lookup',
        telegramUserId: payload.telegramUserId,
        normalizedPhone: normalizePhone(payload.phoneNumber),
      };
    },
  };
}
