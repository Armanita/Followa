export type TelegramIdentityRecord = {
  telegramUserId: string;
  userId: string;
  phoneNumber?: string;
};

export type TelegramPendingConnection = {
  telegramUserId: string;
  userId: string;
};

export type UserLookupResult = {
  id: string;
  mobile: string;
};

const pendingConnections = new Map<string, TelegramPendingConnection>();

export function createTelegramRepository(db: any) {
  return {
    findUserByMobile(mobile: string): Promise<UserLookupResult | null> {
      return db.user.findUnique({
        where: { mobile },
        select: { id: true, mobile: true },
      });
    },

    async createPendingConnection(input: TelegramPendingConnection) {
      pendingConnections.set(input.telegramUserId, input);
      return {
        status: 'pending_confirmation',
        ...input,
      };
    },

    async getPendingConnection(telegramUserId: string) {
      return pendingConnections.get(telegramUserId) ?? null;
    },

    async confirmTelegramIdentity(input: TelegramIdentityRecord) {
      pendingConnections.delete(input.telegramUserId);

      return db.telegramIdentity.upsert({
        where: { telegramUserId: input.telegramUserId },
        update: {
          userId: input.userId,
          phoneNumber: input.phoneNumber,
        },
        create: input,
      });
    },
  };
}
