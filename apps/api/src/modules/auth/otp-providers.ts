import { prisma } from '../../lib/prisma.js';
import { MessagingChannel } from '@prisma/client';
import type { MessagingProvider } from '../messaging/messaging-types.js';
import { createSelectedChannelOtpProvider } from '../messaging/otp-dispatcher.js';
import { getDatabaseConfiguredProvider } from '../messaging/db-backed-provider.js';

export type OtpDeliveryPurpose = 'ACTIVATION' | 'PASSWORD_RESET';
export interface OtpProvider { readonly name: string; sendOtp(mobile: string, code: string, ...context: [purpose?: OtpDeliveryPurpose]): Promise<void>; }

export function createOtpProvider(): OtpProvider {
  const providers: Record<string, MessagingProvider> = {
    telegram: getDatabaseConfiguredProvider(MessagingChannel.TELEGRAM),
    bale: getDatabaseConfiguredProvider(MessagingChannel.BALE),
  } as const;
  return createSelectedChannelOtpProvider(prisma as never, providers as never);
}
