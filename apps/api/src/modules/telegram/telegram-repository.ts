export type TelegramIdentityRecord = {
  telegramUserId: string;
  userId: string;
  phoneNumber?: string;
};

export type TelegramPendingConnection = {
  telegramUserId: string;
  userId: string;
  createdAt: number;
};

export type UserLookupResult = {
  id: string;
  mobile: string;
};

const PENDING_CONNECTION_TTL_MS = 10 * 60 * 1000;
const pendingConnections = new Map<string, TelegramPendingConnection>();

export function createTelegramRepository(db: any) {
  return {
    findUserByMobile(mobile: string): Promise<UserLookupResult | null> {
      return db.user.findUnique({
        where: { mobile },
        select: { id: true, mobile: true },
      });
    },

    async createPendingConnection(input: Omit<TelegramPendingConnection, 'createdAt'>) {
      const pending = {
        ...input,
        createdAt: Date.now(),
      };

      pendingConnections.set(input.telegramUserId, pending);

      return {
        status: 'pending_confirmation',
        ...pending,
      };
    },

    async getPendingConnection(telegramUserId: string) {
      const pending = pendingConnections.get(telegramUserId);

      if (!pending) {
        return null;
      }

      if (Date.now() - pending.createdAt > PENDING_CONNECTION_TTL_MS) {
        pendingConnections.delete(telegramUserId);
        return null;
      }

      return pending;
    },

    async confirmTelegramIdentity(input: TelegramIdentityRecord) {
      const existing = await db.telegramIdentity.findUnique({
        where: { telegramUserId: input.telegramUserId },
        select: { userId: true },
      });

      if (existing && existing.userId !== input.userId) {
        return {
          status: 'rejected',
          reason: 'telegram_identity_already_linked',
        };
      }

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
