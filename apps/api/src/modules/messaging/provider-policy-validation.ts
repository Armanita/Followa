import { z } from 'zod';

export const SYSTEM_PROVIDER_CHANNELS = ['TELEGRAM', 'BALE'] as const;
export const providerChannelSchema = z.enum(SYSTEM_PROVIDER_CHANNELS);
export const systemProviderConfigSchema = z.object({
  channel: providerChannelSchema,
  enabled: z.boolean(),
  notificationEnabled: z.boolean(),
  otpEnabled: z.boolean(),
  displayName: z.string().trim().min(2).max(50),
  botUsername: z.string().trim().max(100).nullable(),
  botToken: z.string().trim().min(8).max(500).nullable().optional(),
});

export const systemProviderBodySchema = z.object({
  channels: z.array(systemProviderConfigSchema).length(SYSTEM_PROVIDER_CHANNELS.length),
}).superRefine((body, ctx) => {
  const channels = body.channels.map((item) => item.channel);
  if (new Set(channels).size !== channels.length || !SYSTEM_PROVIDER_CHANNELS.every((channel) => channels.includes(channel))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['channels'], message: 'هر پیام‌رسان باید دقیقاً یک بار ارسال شود' });
  }
  if (body.channels.filter((item) => item.otpEnabled).length > 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['channels'], message: 'برای OTP فقط یک پیام‌رسان قابل انتخاب است' });
  }
  for (const item of body.channels) {
    if ((item.notificationEnabled || item.otpEnabled) && !item.enabled) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['channels'], message: 'کانال غیرفعال نمی‌تواند برای ارسال انتخاب شود' });
    }
  }
});

export type ValidatedSystemProviderBody = z.infer<typeof systemProviderBodySchema>;
export function parseSystemProviderBody(input: unknown): ValidatedSystemProviderBody {
  return systemProviderBodySchema.parse(input);
}
