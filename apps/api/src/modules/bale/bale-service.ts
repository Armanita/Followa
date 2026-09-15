import type { MessagingProvider } from '../messaging/messaging-types.js';
import type { createMessagingLinkService } from '../messaging/messaging-link-service.js';
import type { BaleReplyMarkup } from './bale-client.js';

type LinkService = ReturnType<typeof createMessagingLinkService>;

const CONTACT_REQUEST_MARKUP: BaleReplyMarkup = {
  keyboard: [[{ text: 'ارسال شماره تماس', request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
};

export function createBaleService(
  linkService: LinkService,
  provider: MessagingProvider,
) {
  return {
    async handleStart(baleUserId: string) {
      if (await linkService.isBaleConnected(baleUserId)) {
        await provider.send({
          destination: baleUserId,
          text: 'حساب بله شما قبلاً به Followa متصل شده است.',
          metadata: { replyMarkup: { remove_keyboard: true } },
        });
        return {
          status: 'already_connected',
          action: 'identity_already_connected',
        };
      }

      await provider.send({
        destination: baleUserId,
        text: 'برای اتصال حساب Followa، لطفاً شماره تماس خود را ارسال کنید.',
        metadata: { replyMarkup: CONTACT_REQUEST_MARKUP },
      });
      return { status: 'received', action: 'request_contact' };
    },

    async handleContact(input: {
      baleUserId: string;
      contactUserId: string;
      phoneNumber: string;
    }) {
      const result = await linkService.beginBaleLink(input);
      if (
        result.status === 'rejected' &&
        result.reason !== 'challenge_delivery_failed'
      ) {
        await provider.send({
          destination: input.baleUserId,
          text: 'امکان اتصال این حساب وجود ندارد. با مدیر شرکت تماس بگیرید.',
        });
      }
      return result;
    },

    confirmConnection(baleUserId: string, token: string) {
      return linkService.confirmBaleLink(baleUserId, token);
    },
  };
}
