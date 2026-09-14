export type TelegramStartPayload = { telegramUserId: number; username?: string; firstName?: string; lastName?: string };
export type TelegramContactPayload = TelegramStartPayload & { phoneNumber: string };

function normalizePhone(phone: string) { const normalized = phone.replace(/\s+/g, '').replace(/^\+/, ''); return normalized.startsWith('98') ? `0${normalized.slice(2)}` : normalized; }

const CONTACT_REQUEST_MARKUP = { keyboard: [[{ text: 'ارسال شماره تماس', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true };
const CONFIRM_CONNECTION_MARKUP = { inline_keyboard: [[{ text: 'تایید اتصال', callback_data: 'telegram_confirm' }]] };

export function createTelegramService(repository: {
 findUserByMobile(mobile: string): Promise<{id:string;mobile:string}|null>;
 findIdentityByTelegramUserId(telegramUserId:string): Promise<{telegramUserId:string;userId:string}|null>;
 createPendingConnection(input:{telegramUserId:string;userId:string}):Promise<unknown>;
 confirmTelegramIdentity(input:{telegramUserId:string;userId:string;phoneNumber?:string}):Promise<unknown>;
}, telegramClient?: { sendMessage(chatId:number|string,text:string,replyMarkup?:unknown):Promise<unknown> }) {
 return {
  async handleStart(payload: TelegramStartPayload) {
   const existingIdentity = await repository.findIdentityByTelegramUserId(String(payload.telegramUserId));
   if (existingIdentity) { await telegramClient?.sendMessage(payload.telegramUserId,'حساب تلگرام شما قبلاً به Followa متصل شده است.'); return {status:'already_connected'}; }
   await telegramClient?.sendMessage(payload.telegramUserId,'برای اتصال حساب Followa، لطفاً شماره تماس خود را ارسال کنید.',CONTACT_REQUEST_MARKUP);
   return {status:'received',action:'request_contact'};
  },
  async handleContact(payload: TelegramContactPayload) {
   const user = await repository.findUserByMobile(normalizePhone(payload.phoneNumber));
   if (!user) return {status:'rejected',reason:'user_not_found'};
   await repository.createPendingConnection({telegramUserId:String(payload.telegramUserId),userId:user.id});
   await telegramClient?.sendMessage(payload.telegramUserId,'حساب شما پیدا شد. لطفاً تایید اتصال را انجام دهید.',CONFIRM_CONNECTION_MARKUP);
   return {status:'pending_confirmation',userId:user.id};
  },
  async confirmConnection(payload: TelegramContactPayload, userId:string) {
   return repository.confirmTelegramIdentity({telegramUserId:String(payload.telegramUserId),userId,phoneNumber:normalizePhone(payload.phoneNumber)});
  }
 };
}
