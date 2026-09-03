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

      return {
        status: 'pending_confirmation',
        userId: user.id,
        telegramUserId: payload.telegramUserId,
        action: 'confirm_identity',
      };
    },

    async confirmConnection(payload: TelegramContactPayload, userId: string) {
      return repository.confirmTelegramIdentity({
        telegramUserId: String(payload.telegramUserId),
        userId,
        phoneNumber: normalizePhone(payload.phoneNumber),
      });
    },
  };
}
