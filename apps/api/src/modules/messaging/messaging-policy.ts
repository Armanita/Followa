import type { MessagingChannel } from '@prisma/client';

export const MESSAGING_SETTINGS_CHANNELS = ['TELEGRAM', 'BALE'] as const satisfies readonly MessagingChannel[];

export type MessagingSettingsChannel = (typeof MESSAGING_SETTINGS_CHANNELS)[number];
export type OptionalPreference = boolean | null;

export function resolveNotificationPolicy(input: {
  systemEnabled: boolean;
  systemNotificationEnabled: boolean;
  companyPreference: OptionalPreference;
  membershipPreference: OptionalPreference;
}) {
  const systemAllows = input.systemEnabled && input.systemNotificationEnabled;
  const companyAllows = systemAllows && (input.companyPreference ?? true);
  const enabled = companyAllows && (input.membershipPreference ?? true);

  return {
    systemAllows,
    companyAllows,
    enabled,
    companySource: input.companyPreference === null ? 'INHERITED' : 'EXPLICIT',
    membershipSource: input.membershipPreference === null ? 'INHERITED' : 'EXPLICIT',
  } as const;
}

export function resolveOtpPolicy(input: {
  systemEnabled: boolean;
  systemOtpEnabled: boolean;
}) {
  return {
    enabled: input.systemEnabled && input.systemOtpEnabled,
  } as const;
}

export function isSettingsChannel(channel: MessagingChannel): channel is MessagingSettingsChannel {
  return MESSAGING_SETTINGS_CHANNELS.includes(channel as MessagingSettingsChannel);
}
