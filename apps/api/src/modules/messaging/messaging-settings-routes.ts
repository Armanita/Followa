import { MessagingChannel } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { badRequest } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { requireCompanyUser, requireManager, requireSystemAdmin } from '../../plugins/auth.js';
import { MESSAGING_SETTINGS_CHANNELS, resolveNotificationPolicy } from './messaging-policy.js';
import { findAllProviderConfigs } from './provider-config-repository.js';
import {
  getProviderSummaries,
  isMasterKeyConfigured,
  saveProviderConfigs,
} from './provider-config-service.js';

const channelSchema = z.enum(['TELEGRAM', 'BALE']);
const systemBodySchema = z.object({
  channels: z.array(z.object({
    channel: channelSchema,
    enabled: z.boolean(),
    notificationEnabled: z.boolean(),
    otpEnabled: z.boolean(),
    displayName: z.string().trim().min(2).max(50),
    botUsername: z.string().trim().max(100).nullable(),
    botToken: z.string().trim().min(8).max(500).nullable().optional(),
  })).length(MESSAGING_SETTINGS_CHANNELS.length),
}).superRefine((body, ctx) => {
  if (new Set(body.channels.map((item) => item.channel)).size !== body.channels.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '\u0647\u0631 \u067e\u06cc\u0627\u0645\u200c\u0631\u0633\u0627\u0646 \u0641\u0642\u0637 \u06cc\u06a9\u200c\u0628\u0627\u0631 \u0645\u062c\u0627\u0632 \u0627\u0633\u062a' });
  }
  if (body.channels.filter((item) => item.otpEnabled).length > 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '\u0628\u0631\u0627\u06cc OTP \u0641\u0642\u0637 \u06cc\u06a9 \u067e\u06cc\u0627\u0645\u200c\u0631\u0633\u0627\u0646 \u0642\u0627\u0628\u0644 \u0627\u0646\u062a\u062e\u0627\u0628 \u0627\u0633\u062a' });
  }
  for (const item of body.channels) {
    if ((item.notificationEnabled || item.otpEnabled) && !item.enabled) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: '\u06a9\u0627\u0646\u0627\u0644 \u063a\u06cc\u0631\u0641\u0639\u0627\u0644 \u0646\u0645\u06cc\u200c\u062a\u0648\u0627\u0646\u062f \u0628\u0631\u0627\u06cc \u0627\u0631\u0633\u0627\u0644 \u0627\u0646\u062a\u062e\u0627\u0628 \u0634\u0648\u062f' });
    }
  }
});
const notificationBodySchema = z.object({
  channels: z.array(z.object({ channel: channelSchema, notificationEnabled: z.boolean().nullable() }))
    .length(MESSAGING_SETTINGS_CHANNELS.length),
}).superRefine((body, ctx) => {
  if (new Set(body.channels.map((item) => item.channel)).size !== body.channels.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '\u0647\u0631 \u067e\u06cc\u0627\u0645\u200c\u0631\u0633\u0627\u0646 \u0641\u0642\u0637 \u06cc\u06a9\u200c\u0628\u0627\u0631 \u0645\u062c\u0627\u0632 \u0627\u0633\u062a' });
  }
});
const meBodySchema = notificationBodySchema.and(z.object({ otpChannel: channelSchema.nullable() }));

const enforcementStatus = 'NOT_ACTIVE_UNTIL_P8_P9' as const;

export async function messagingSettingsRoutes(app: FastifyInstance): Promise<void> {
  // -----------------------------------------------------------------------
  // System Admin — provider configuration (P11-A service layer)
  // -----------------------------------------------------------------------

  app.get('/admin/messaging-settings', { preHandler: requireSystemAdmin }, async () => {
    return {
      enforcementStatus,
      channels: await getProviderSummaries(MESSAGING_SETTINGS_CHANNELS),
    };
  });

  app.patch('/admin/messaging-settings', { preHandler: requireSystemAdmin }, async (request) => {
    const body = systemBodySchema.parse(request.body);
    const existing = await findAllProviderConfigs(MESSAGING_SETTINGS_CHANNELS);

    if (body.channels.some((item) => item.botToken !== undefined) && !isMasterKeyConfigured()) {
      throw badRequest('\u06a9\u0644\u06cc\u062f \u0627\u0635\u0644\u06cc \u0631\u0645\u0632\u0646\u06af\u0627\u0631\u06cc \u062a\u0646\u0638\u06cc\u0645\u0627\u062a \u067e\u06cc\u0627\u0645\u200c\u0631\u0633\u0627\u0646 \u0631\u0648\u06cc \u0633\u0631\u0648\u0631 \u062a\u0646\u0638\u06cc\u0645 \u0646\u0634\u062f\u0647 \u0627\u0633\u062a');
    }
    for (const item of body.channels) {
      const hasCredential = item.botToken === null
        ? false
        : Boolean(item.botToken || existing.get(item.channel as MessagingChannel)?.credentialsEncrypted);
      if (item.enabled && !hasCredential) throw badRequest(`\u062a\u0648\u06a9\u0646 ${item.displayName} \u062a\u0646\u0638\u06cc\u0645 \u0646\u0634\u062f\u0647 \u0627\u0633\u062a`);
    }

    await saveProviderConfigs(
      body.channels.map(({ botToken, ...rest }) => ({
        ...rest,
        channel: rest.channel as MessagingChannel,
        botToken,
      })),
    );

    return { message: '\u062a\u0646\u0638\u06cc\u0645\u0627\u062a \u067e\u06cc\u0627\u0645\u200c\u0631\u0633\u0627\u0646\u200c\u0647\u0627 \u0628\u0627 \u0645\u0648\u0641\u0642\u06cc\u062a \u0630\u062e\u06cc\u0631\u0647 \u0634\u062f.' };
  });

  // -----------------------------------------------------------------------
  // Company Manager — notification channel preferences
  // -----------------------------------------------------------------------

  app.get('/messaging/settings/company', { preHandler: requireManager }, async (request) => {
    const [systems, rows] = await Promise.all([
      findAllProviderConfigs(MESSAGING_SETTINGS_CHANNELS),
      prisma.companyMessagingPolicy.findMany({ where: { companyId: request.actor.companyId! } }),
    ]);
    const company = new Map(rows.map((row) => [row.channel, row.notificationEnabled]));
    return {
      enforcementStatus,
      channels: MESSAGING_SETTINGS_CHANNELS.map((channel) => {
        const value = company.get(channel) ?? null;
        const system = systems.get(channel);
        return {
          channel,
          notificationEnabled: value,
          effective: resolveNotificationPolicy({
            systemEnabled: system?.enabled ?? false,
            systemNotificationEnabled: system?.notificationEnabled ?? false,
            companyPreference: value,
            membershipPreference: null,
          }).companyAllows,
        };
      }),
    };
  });

  app.patch('/messaging/settings/company', { preHandler: requireManager }, async (request) => {
    const body = notificationBodySchema.parse(request.body);
    const systems = await findAllProviderConfigs(MESSAGING_SETTINGS_CHANNELS);
    for (const item of body.channels) {
      const policy = systems.get(item.channel as MessagingChannel);
      if (item.notificationEnabled === true && !(policy?.enabled && policy.notificationEnabled)) {
        throw badRequest('\u0627\u06cc\u0646 \u06a9\u0627\u0646\u0627\u0644 \u062f\u0631 \u0633\u0637\u062d \u0633\u06cc\u0633\u062a\u0645 \u0628\u0631\u0627\u06cc \u0627\u0639\u0644\u0627\u0646 \u0641\u0639\u0627\u0644 \u0646\u06cc\u0633\u062a');
      }
    }
    await prisma.$transaction(body.channels.map((item) => item.notificationEnabled === null
      ? prisma.companyMessagingPolicy.deleteMany({ where: { companyId: request.actor.companyId!, channel: item.channel as MessagingChannel } })
      : prisma.companyMessagingPolicy.upsert({
        where: { companyId_channel: { companyId: request.actor.companyId!, channel: item.channel as MessagingChannel } },
        create: { companyId: request.actor.companyId!, channel: item.channel as MessagingChannel, notificationEnabled: item.notificationEnabled },
        update: { notificationEnabled: item.notificationEnabled },
      })));
    return { message: '\u0633\u06cc\u0627\u0633\u062a \u0634\u0631\u06a9\u062a \u0630\u062e\u06cc\u0631\u0647 \u0634\u062f\u061b \u0647\u0646\u0648\u0632 \u0631\u0648\u06cc \u0627\u0631\u0633\u0627\u0644 \u0627\u062b\u0631 \u0646\u062f\u0627\u0631\u062f.' };
  });

  // -----------------------------------------------------------------------
  // Company User — personal notification & OTP preferences
  // -----------------------------------------------------------------------

  app.get('/messaging/settings/me', { preHandler: requireCompanyUser }, async (request) => {
    const [systems, companyRows, memberRows, userPreference, identities] = await Promise.all([
      findAllProviderConfigs(MESSAGING_SETTINGS_CHANNELS),
      prisma.companyMessagingPolicy.findMany({ where: { companyId: request.actor.companyId! } }),
      prisma.membershipMessagingPreference.findMany({ where: { membershipId: request.actor.membershipId! } }),
      prisma.userMessagingPreference.findUnique({ where: { userId: request.actor.id } }),
      prisma.messagingIdentity.findMany({ where: { userId: request.actor.id, channel: { in: [...MESSAGING_SETTINGS_CHANNELS] } } }),
    ]);
    const company = new Map(companyRows.map((row) => [row.channel, row.notificationEnabled]));
    const membership = new Map(memberRows.map((row) => [row.channel, row.notificationEnabled]));
    const connected = new Set(identities.filter((row) => row.status === 'ACTIVE' && row.verifiedAt).map((row) => row.channel));
    return {
      enforcementStatus,
      otpChannel: userPreference?.otpChannel ?? null,
      channels: MESSAGING_SETTINGS_CHANNELS.map((channel) => {
        const system = systems.get(channel);
        const companyValue = company.get(channel) ?? null;
        const membershipValue = membership.get(channel) ?? null;
        const resolved = resolveNotificationPolicy({
          systemEnabled: system?.enabled ?? false,
          systemNotificationEnabled: system?.notificationEnabled ?? false,
          companyPreference: companyValue,
          membershipPreference: membershipValue,
        });
        return {
          channel,
          notificationEnabled: membershipValue,
          effective: resolved.enabled,
          connected: connected.has(channel),
          deliveryReady: resolved.enabled && connected.has(channel),
          otpAvailable: Boolean(system?.enabled && system.otpEnabled),
        };
      }),
    };
  });

  app.patch('/messaging/settings/me', { preHandler: requireCompanyUser }, async (request) => {
    const body = meBodySchema.parse(request.body);
    const systems = await findAllProviderConfigs(MESSAGING_SETTINGS_CHANNELS);
    for (const item of body.channels) {
      if (item.notificationEnabled === true) {
        const policy = systems.get(item.channel as MessagingChannel);
        if (!(policy?.enabled && policy.notificationEnabled)) throw badRequest('\u0627\u06cc\u0646 \u06a9\u0627\u0646\u0627\u0644 \u062f\u0631 \u0633\u0637\u062d \u0633\u06cc\u0633\u062a\u0645 \u0628\u0631\u0627\u06cc \u0627\u0639\u0644\u0627\u0646 \u0641\u0639\u0627\u0644 \u0646\u06cc\u0633\u062a');
      }
    }
    if (body.otpChannel) {
      const otpPolicy = systems.get(body.otpChannel as MessagingChannel);
      if (!(otpPolicy?.enabled && otpPolicy.otpEnabled)) throw badRequest('\u0627\u06cc\u0646 \u06a9\u0627\u0646\u0627\u0644 \u062f\u0631 \u0633\u0637\u062d \u0633\u06cc\u0633\u062a\u0645 \u0628\u0631\u0627\u06cc OTP \u0641\u0639\u0627\u0644 \u0646\u06cc\u0633\u062a');
      }
    }
    await prisma.$transaction([
      ...body.channels.map((item) => item.notificationEnabled === null
        ? prisma.membershipMessagingPreference.deleteMany({ where: { membershipId: request.actor.membershipId!, channel: item.channel as MessagingChannel } })
        : prisma.membershipMessagingPreference.upsert({
          where: { membershipId_channel: { membershipId: request.actor.membershipId!, channel: item.channel as MessagingChannel } },
          create: { membershipId: request.actor.membershipId!, channel: item.channel as MessagingChannel, notificationEnabled: item.notificationEnabled },
          update: { notificationEnabled: item.notificationEnabled },
        })),
      prisma.userMessagingPreference.upsert({
        where: { userId: request.actor.id },
        create: { userId: request.actor.id, otpChannel: body.otpChannel as MessagingChannel | null },
        update: { otpChannel: body.otpChannel as MessagingChannel | null },
      }),
    ]);
    return { message: '\u062a\u0631\u062c\u06cc\u062d\u0627\u062a \u0634\u0645\u0627 \u0630\u062e\u06cc\u0631\u0647 \u0634\u062f\u061b \u0647\u0646\u0648\u0632 \u0631\u0648\u06cc \u0627\u0631\u0633\u0627\u0644 \u0627\u062b\u0631 \u0646\u062f\u0627\u0631\u062f.' };
  });
}
