export type TelegramStartPayload = {
  telegramUserId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
};

export type TelegramContactPayload = TelegramStartPayload & {
  phoneNumber: string;
};

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
        action: 'identity_lookup_pending',
        telegramUserId: payload.telegramUserId,
        phoneNumber: payload.phoneNumber,
      };
    },
  };
}
