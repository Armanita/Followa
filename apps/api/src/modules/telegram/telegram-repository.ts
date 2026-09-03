export type TelegramIdentityRecord = {
  telegramUserId: string;
  userId: string;
};

export type UserLookupResult = {
  id: string;
  mobile: string;
};

export function createTelegramRepository(db: any) {
  return {
    findUserByMobile(mobile: string): Promise<UserLookupResult | null> {
      return db.user.findUnique({
        where: { mobile },
        select: { id: true, mobile: true },
      });
    },

    async attachTelegramIdentity(input: TelegramIdentityRecord) {
      return db.telegramIdentity.upsert({
        where: { telegramUserId: input.telegramUserId },
        update: { userId: input.userId },
        create: input,
      });
    },
  };
}
