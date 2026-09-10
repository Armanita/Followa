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
  const normalized = phone.replace(/\s+/g, '').replace(/^\+/, '');

  if (normalized.startsWith('98')) {
    return `0${normalized.slice(2)}`;
  }

  return normalized;
}

const CONTACT_REQUEST_MARKUP = {
  keyboard: [[{ text: 'ارسال شماره تماس', request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
};

const CONFIRM_CONNECTION_MARKUP = {
  inline_keyboard: [
    [
      {
        text: 'تایید اتصال',
        callback_data: 'telegram_confirm',
      },
    ],
  ],
};

export function createTelegramService(repository: {
  findUserByMobile(mobile: string): Promise<{ id: string; mobile: string } | null>;
  findIdentityByTelegramUserId(telegramUserId: string): Promise<{ telegramUserId: string; userId: string } | null>;
  createPendingConnection(input: { telegramUserId: string; userId: string }): Promise<unknown>;
  confirmTelegramIdentity(input: {
    telegramUserId: string;
    userId: string;
    phoneNumber?: string;
  }): Promise<unknown>;
}, telegramClient?: {
  sendMessage(chatId: number | string, text: string, replyMarkup?: unknown): Promise<unknown>;
}) {
  return {
    async handleStart(payload: TelegramStartPayload) {
      const existingIdentity = await repository.findIdentityByTelegramUserId(
        String(payload.telegramUserId),
      );

      if (existingIdentity) {
        await telegramClient?.sendMessage(
          payload.telegramUserId,
          'حساب تلگرام شما قبلاً به Followa متصل شده است.',
        );

        return {
          status: 'already_connected',
          action: 'identity_already_connected',
          telegramUserId: payload.telegramUserId,
        };
      }

      await telegramClient?.sendMessage(
        payload.telegramUserId,
        'برای اتصال حساب Followa، لطفاً شماره تماس خود را ارسال کنید.',
        CONTACT_REQUEST_MARKUP,
      );

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
        await telegramClient?.sendMessage(
          payload.telegramUserId,
          'حسابی با این شماره پیدا نشد.',
        );

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
        'حساب شما پیدا شد. لطفاً تایید اتصال را انجام دهید.',
        CONFIRM_CONNECTION_MARKUP,
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

      const result = await repository.confirmTelegramIdentity({
        telegramUserId: String(payload.telegramUserId),
        userId,
        phoneNumber: phoneNumber || undefined,
      });

      if (telegramClient && 'telegramUserId' in (result as object)) {
        await telegramClient.sendMessage(
          payload.telegramUserId,
          'اتصال حساب تلگرام شما با موفقیت انجام شد.',
        );
      }

      return result;
    },
  };
}
