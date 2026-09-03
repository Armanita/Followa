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
  attachTelegramIdentity(input: { telegramUserId: string; userId: string }): Promise<unknown>;
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
      const user = await repository.findUserByMobile(normalizePhone(payload.phoneNumber));

      if (!user) {
        return {
          status: 'rejected',
          reason: 'user_not_found',
          telegramUserId: payload.telegramUserId,
        };
      }

      await repository.attachTelegramIdentity({
        telegramUserId: String(payload.telegramUserId),
        userId: user.id,
      });

      return {
        status: 'linked',
        userId: user.id,
        telegramUserId: payload.telegramUserId,
      };
    },
  };
}
