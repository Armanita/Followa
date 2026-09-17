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
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'هر پیام‌رسان فقط یک‌بار مجاز است' });
  }
  if (body.channels.filter((item) => item.otpEnabled).length > 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'برای OTP فقط یک پیام‌رسان قابل انتخاب است' });
  }
  for (const item of body.channels) {
    if ((item.notificationEnabled || item.otpEnabled) && !item.enabled) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'کانال غیرفعال نمی‌تواند برای ارسال انتخاب شود' });
    }
  }
});
const notificationBodySchema = z.object({
  channels: z.array(z.object({ channel: channelSchema, notificationEnabled: z.boolean().nullable() }))
    .length(MESSAGING_SETTINGS_CHANNELS.length),
}).superRefine((body, ctx) => {
  if (new Set(body.channels.map((item) => item.channel)).size !== body.channels.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'هر پیام‌رسان فقط یک‌بار مجاز است' });
  }
});
const meBodySchema = notificationBodySchema.and(z.object({ otpChannel: channelSchema.nullable() }));

const enforcementStatus = 'NOT_ACTIVE_UNTIL_P8_P9' as const;

export async function messagingSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/admin/messaging-settings', { preHandler: requireSystemAdmin }, async (request) => {
    app.log.warn({ route: request.routeOptions.url, actorKind: request.actor?.kind }, 'temporary messaging settings handler entered');
    app.log.warn({ route: request.routeOptions.url }, 'temporary before getProviderSummaries');
    const channels = await getProviderSummaries(MESSAGING_SETTINGS_CHANNELS);
    app.log.warn({ route: request.routeOptions.url, channelCount: channels.length }, 'temporary after getProviderSummaries before response');
    const response = { enforcementStatus, channels };
    app.log.warn({ route: request.routeOptions.url }, 'temporary response ready');
    return response;
  });

  app.patch('/admin/messaging-settings', { preHandler: requireSystemAdmin }, async (request) => {
    const body = systemBodySchema.parse(request.body);
    const existing = await findAllProviderConfigs(MESSAGING_SETTINGS_CHANNELS);

    if (body.channels.some((item) => item.botToken !== undefined) && !isMasterKeyConfigured()) {
      throw badRequest('کلید اصلی رمزنگاری تنظیمات پیام‌رسان روی سرور تنظیم نشده است');
    }
    for (const item of body.channels) {
      const hasCredential = item.botToken === null
        ? false
        : Boolean(item.botToken || existing.get(item.channel as MessagingChannel)?.credentialsEncrypted);
      if (item.enabled && !hasCredential) throw badRequest(`توکن ${item.displayName} تنظیم نشده است`);
    }

    await saveProviderConfigs(
      body.channels.map(({ botToken, ...rest }) => ({
        ...rest,
        channel: rest.channel as MessagingChannel,
        botToken,
      })),
    );

    return { message: 'تنظیمات پیام‌رسان‌ها با موفقیت ذخیره شد.' };
  });

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
        throw badRequest('این کانال در سطح سیستم برای اعلان فعال نیست');
      }
    }
    const companyPreferenceOperations = body.channels.map((item) => {
      if (item.notificationEnabled === null) {
        return prisma.companyMessagingPolicy.deleteMany({
          where: { companyId: request.actor.companyId!, channel: item.channel as MessagingChannel },
        });
      }
      return prisma.companyMessagingPolicy.upsert({
        where: { companyId_channel: { companyId: request.actor.companyId!, channel: item.channel as MessagingChannel } },
        create: { companyId: request.actor.companyId!, channel: item.channel as MessagingChannel, notificationEnabled: item.notificationEnabled },
        update: { notificationEnabled: item.notificationEnabled },
      });
    });
    await prisma.$transaction(companyPreferenceOperations);
    return { message: 'سیاست شرکت ذخیره شد؛ هنوز روی ارسال اثر ندارد.' };
  });

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
        if (!(policy?.enabled && policy.notificationEnabled)) {
          throw badRequest('این کانال در سطح سیستم برای اعلان فعال نیست');
        }
      }
    }
    if (body.otpChannel) {
      const otpPolicy = systems.get(body.otpChannel as MessagingChannel);
      if (!(otpPolicy?.enabled && otpPolicy.otpEnabled)) {
        throw badRequest('این کانال در سطح سیستم برای OTP فعال نیست');
      }
    }
    const membershipPreferenceOperations = body.channels.map((item) => {
      if (item.notificationEnabled === null) {
        return prisma.membershipMessagingPreference.deleteMany({
          where: { membershipId: request.actor.membershipId!, channel: item.channel as MessagingChannel },
        });
      }
      return prisma.membershipMessagingPreference.upsert({
        where: { membershipId_channel: { membershipId: request.actor.membershipId!, channel: item.channel as MessagingChannel } },
        create: { membershipId: request.actor.membershipId!, channel: item.channel as MessagingChannel, notificationEnabled: item.notificationEnabled },
        update: { notificationEnabled: item.notificationEnabled },
      });
    });
    await prisma.$transaction([
      ...membershipPreferenceOperations,
      prisma.userMessagingPreference.upsert({
        where: { userId: request.actor.id },
        create: { userId: request.actor.id, otpChannel: body.otpChannel as MessagingChannel | null },
        update: { otpChannel: body.otpChannel as MessagingChannel | null },
      }),
    ]);
    return { message: 'ترجیحات شما ذخیره شد؛ هنوز روی ارسال اثر ندارد.' };
  });
}
