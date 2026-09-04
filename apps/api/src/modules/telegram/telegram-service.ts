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

export function createTelegramService(repository: {
  findUserByMobile(mobile: string): Promise<{ id: string; mobile: string } | null>;
  createPendingConnection(input: { telegramUserId: string; userId: string }): Promise<unknown>;
  confirmTelegramIdentity(input: {
    telegramUserId: string;
    userId: string;
    phoneNumber?: string;
  }): Promise<unknown>;
}, telegramClient?: {
  sendMessage(chatId: number | string, text: string): Promise<unknown>;
}) {
  return {
    handleStart(payload: TelegramStartPayload) {
      return {
        status: 'received',
        action: 'request_contact',
        telegramUserId: payload.telegramUserId,
      };
    },

    async handleContact(payload: TelegramContactPayload) {
      const mobile = normalizePhone(payload.phoneNumber);
      const user = await repository.findUserByMobile(mobile);

      if (!user) {
        return {
          status: 'rejected',
          reason: 'user_not_found',
          telegramUserId: payload.telegramUserId,
        };
      }

      await repository.createPendingConnection({
        telegramUserId: String(payload.telegramUserId),
        userId: user.id,
      });

      await telegramClient?.sendMessage(
        payload.telegramUserId,
        '\u062d\u0633\u0627\u0628 \u0634\u0645\u0627 \u067e\u06cc\u062f\u0627 \u0634\u062f. \u0644\u0637\u0641\u0627 \u062a\u0627\u06cc\u06cc\u062f \u0627\u062a\u0635\u0627\u0644 \u0631\u0627 \u0627\u0646\u062c\u0627\u0645 \u062f\u0647\u06cc\u062f.',
      );

      return {
        status: 'pending_confirmation',
        userId: user.id,
        telegramUserId: payload.telegramUserId,
        action: 'confirm_identity',
      };
    },

    async confirmConnection(payload: TelegramContactPayload, userId: string) {
      const phoneNumber = normalizePhone(payload.phoneNumber);

      if (!phoneNumber) {
        return {
          status: 'rejected',
          reason: 'invalid_phone_number',
        };
      }

      const result = await repository.confirmTelegramIdentity({
        telegramUserId: String(payload.telegramUserId),
        userId,
        phoneNumber,
      });

      if (telegramClient && 'telegramUserId' in (result as object)) {
        await telegramClient.sendMessage(
          payload.telegramUserId,
          '\u0627\u062a\u0635\u0627\u0644 \u062d\u0633\u0627\u0628 \u062a\u0644\u06af\u0631\u0627\u0645 \u0634\u0645\u0627 \u0628\u0627 \u0645\u0648\u0641\u0642\u06cc\u062a \u0627\u0646\u062c\u0627\u0645 \u0634\u062f.',
        );
      }

      return result;
    },
  };
}
