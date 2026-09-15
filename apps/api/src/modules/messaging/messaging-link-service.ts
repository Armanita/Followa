import { createHash, randomBytes } from 'node:crypto';
import { MessagingChannel } from '@prisma/client';
import type { MessagingProvider } from './messaging-types.js';
import type { createMessagingRepository } from './messaging-repository.js';

const LINK_TTL_MS = 10 * 60 * 1000;

type LinkRepository = Pick<
  ReturnType<typeof createMessagingRepository>,
  | 'beginLinkChallenge'
  | 'cancelLinkChallenge'
  | 'confirmLinkChallenge'
  | 'findIdentityByExternalId'
>;

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function normalizePhone(phone: string): string {
  const normalized = phone.replace(/\s+/g, '').replace(/^\+/, '');
  return normalized.startsWith('98')
    ? `0${normalized.slice(2)}`
    : normalized;
}

export function createMessagingLinkService(
  repository: LinkRepository,
  provider: MessagingProvider,
) {
  return {
    async isBaleConnected(baleUserId: string): Promise<boolean> {
      const identity = await repository.findIdentityByExternalId(
        MessagingChannel.BALE,
        baleUserId,
      );
      return Boolean(
        identity &&
          identity.status === 'ACTIVE' &&
          identity.verifiedAt,
      );
    },

    async beginBaleLink(input: {
      baleUserId: string;
      contactUserId: string;
      phoneNumber: string;
    }) {
      if (input.baleUserId !== input.contactUserId) {
        return { status: 'rejected', reason: 'contact_owner_mismatch' };
      }

      const mobile = normalizePhone(input.phoneNumber);
      if (!/^09\d{9}$/.test(mobile)) {
        return { status: 'rejected', reason: 'invalid_phone_number' };
      }

      const token = randomBytes(16).toString('hex');
      const hash = tokenHash(token);
      const result = await repository.beginLinkChallenge({
        mobile,
        channel: MessagingChannel.BALE,
        externalUserId: input.baleUserId,
        destinationId: input.baleUserId,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + LINK_TTL_MS),
      });
      if (result.status !== 'created') {
        return result;
      }

      try {
        await provider.send({
          destination: input.baleUserId,
          text: 'حساب شما پیدا شد. لطفاً تایید اتصال را انجام دهید.',
          metadata: {
            replyMarkup: {
              inline_keyboard: [
                [
                  {
                    text: 'تایید اتصال',
                    callback_data: `bale_confirm:${token}`,
                  },
                ],
              ],
            },
          },
        });
      } catch {
        await repository.cancelLinkChallenge(hash);
        return {
          status: 'rejected',
          reason: 'challenge_delivery_failed',
        };
      }

      return {
        status: 'pending_confirmation',
        action: 'confirm_identity',
      };
    },

    async confirmBaleLink(baleUserId: string, token: string) {
      if (!/^[a-f0-9]{32}$/.test(token)) {
        return { status: 'rejected', reason: 'invalid_confirmation' };
      }

      const result = await repository.confirmLinkChallenge({
        channel: MessagingChannel.BALE,
        externalUserId: baleUserId,
        tokenHash: tokenHash(token),
        verificationMethod: 'BALE_CONTACT_CALLBACK_V1',
      });
      if (result.status === 'connected') {
        try {
          await provider.send({
            destination: baleUserId,
            text: 'اتصال حساب بله شما با موفقیت انجام شد.',
          });
        } catch {
          // The identity is already committed; acknowledgement failure must not
          // make a successful one-time confirmation look reusable.
        }
        return { status: 'connected' };
      }
      return result;
    },
  };
}
