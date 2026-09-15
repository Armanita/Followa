import type { TelegramReplyMarkup } from './telegram-client.js';
import type { createTelegramRepository } from './telegram-repository.js';

export type TelegramStartPayload = {
  telegramUserId: number;
};

export type TelegramContactPayload = TelegramStartPayload & {
  phoneNumber: string;
  contactUserId: number;
};

function normalizePhone(phone: string) {
  const normalized = phone.replace(/\s+/g, '').replace(/^\+/, '');
  return normalized.startsWith('98') ? `0${normalized.slice(2)}` : normalized;
}

const CONTACT_REQUEST_MARKUP: TelegramReplyMarkup = {
  keyboard: [[{ text: 'ارسال شماره تماس', request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
};

type TelegramServiceRepository = Pick<
  ReturnType<typeof createTelegramRepository>,
  | 'findUserByMobile'
  | 'findIdentityByTelegramUserId'
  | 'createPendingConnection'
  | 'confirmPendingConnection'
>;

export function createTelegramService(
  repository: TelegramServiceRepository,
  telegramClient?: {
    sendMessage(
      chatId: number | string,
      text: string,
      replyMarkup?: TelegramReplyMarkup,
    ): Promise<unknown>;
  },
) {
  return {
    async handleStart(payload: TelegramStartPayload) {
      const existingIdentity = await repository.findIdentityByTelegramUserId(
        String(payload.telegramUserId),
      );

      if (existingIdentity) {
        await telegramClient?.sendMessage(
          payload.telegramUserId,
          'حساب تلگرام شما قبلاً به Followa متصل شده است.',
          { remove_keyboard: true },
        );
        return {
          status: 'already_connected',
          action: 'identity_already_connected',
        };
      }

      // Eligibility is checked after Telegram proves the sender's own contact.
      await telegramClient?.sendMessage(
        payload.telegramUserId,
        'برای اتصال حساب Followa، لطفاً شماره تماس خود را ارسال کنید.',
        CONTACT_REQUEST_MARKUP,
      );
      return { status: 'received', action: 'request_contact' };
    },

    async handleContact(payload: TelegramContactPayload) {
      if (payload.contactUserId !== payload.telegramUserId) {
        return { status: 'rejected', reason: 'contact_owner_mismatch' };
      }

      const mobile = normalizePhone(payload.phoneNumber);
      if (!/^09\d{9}$/.test(mobile)) {
        return { status: 'rejected', reason: 'invalid_phone_number' };
      }

      const user = await repository.findUserByMobile(mobile);
      const pending = user
        ? await repository.createPendingConnection({
            telegramUserId: String(payload.telegramUserId),
            userId: user.id,
            mobile,
          })
        : null;

      if (!pending) {
        await telegramClient?.sendMessage(
          payload.telegramUserId,
          'امکان اتصال این حساب وجود ندارد. با مدیر شرکت تماس بگیرید.',
        );
        return { status: 'rejected', reason: 'connection_not_allowed' };
      }

      await telegramClient?.sendMessage(
        payload.telegramUserId,
        'حساب شما پیدا شد. لطفاً تایید اتصال را انجام دهید.',
        {
          inline_keyboard: [
            [
              {
                text: 'تایید اتصال',
                callback_data: `telegram_confirm:${pending.token}`,
              },
            ],
          ],
        },
      );

      // Never expose the proof or matched Followa user id in the HTTP response.
      return { status: 'pending_confirmation', action: 'confirm_identity' };
    },

    async confirmConnection(telegramUserId: number, token: string) {
      const result = await repository.confirmPendingConnection(
        String(telegramUserId),
        token,
      );

      if (result.status === 'connected') {
        await telegramClient?.sendMessage(
          telegramUserId,
          'اتصال حساب تلگرام شما با موفقیت انجام شد.',
        );
      }

      return result;
    },
  };
}
