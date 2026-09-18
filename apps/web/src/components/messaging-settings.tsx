'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { btnPrimary, Card, Spinner } from '@/components/ui';
import { PanelHeader } from '@/components/workspace/page';

type Channel = 'TELEGRAM' | 'BALE';
type Choice = 'inherit' | 'on' | 'off';
type ChannelView = {
  channel: Channel;
  enabled?: boolean;
  notificationEnabled: boolean | null;
  otpEnabled?: boolean;
  effective?: boolean;
  connected?: boolean;
  deliveryReady?: boolean;
  otpAvailable?: boolean;
  displayName?: string;
  botUsername?: string | null;
  botToken?: string | null;
  webhookSecret?: string | null;
  credentialConfigured?: boolean;
  botTokenMasked?: string | null;
  webhookSecretMasked?: string | null;
};
type Response = {
  enforcementStatus: 'NOT_ACTIVE_UNTIL_P8_P9';
  channels: ChannelView[];
  otpChannel?: Channel | null;
};

const labels: Record<Channel, string> = { TELEGRAM: 'تلگرام', BALE: 'بله' };
const choice = (value: boolean | null): Choice => value === null ? 'inherit' : value ? 'on' : 'off';
const value = (selection: Choice): boolean | null => selection === 'inherit' ? null : selection === 'on';

export function MessagingSettings({ mode, isManager = false }: { mode: 'system' | 'company-user'; isManager?: boolean }) {
  const [system, setSystem] = useState<Response | null>(null);
  const [company, setCompany] = useState<Response | null>(null);
  const [personal, setPersonal] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      if (mode === 'system') {
        setSystem(await api.get<Response>('/admin/messaging-settings'));
      } else {
        const [me, companyPolicy] = await Promise.all([
          api.get<Response>('/messaging/settings/me'),
          isManager ? api.get<Response>('/messaging/settings/company') : Promise.resolve(null),
        ]);
        setPersonal(me);
        setCompany(companyPolicy);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'خطا در دریافت تنظیمات پیام‌رسان');
    } finally {
      setLoading(false);
    }
  }, [isManager, mode]);

  useEffect(() => { void load(); }, [load]);

  const saveSystem = async () => {
    if (!system) return;
    setSaving('system');
    try {
      const result = await api.patch<{ message: string }>('/admin/messaging-settings', { channels: system.channels });
      setMessage(result.message);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'خطا در ذخیره'); }
    finally { setSaving(''); }
  };

  const saveCompany = async () => {
    if (!company) return;
    setSaving('company');
    try {
      const result = await api.patch<{ message: string }>('/messaging/settings/company', {
        channels: company.channels.map(({ channel, notificationEnabled }) => ({ channel, notificationEnabled })),
      });
      setMessage(result.message);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'خطا در ذخیره'); }
    finally { setSaving(''); }
  };

  const savePersonal = async () => {
    if (!personal) return;
    setSaving('personal');
    try {
      const result = await api.patch<{ message: string }>('/messaging/settings/me', {
        channels: personal.channels.map(({ channel, notificationEnabled }) => ({ channel, notificationEnabled })),
        otpChannel: personal.otpChannel ?? null,
      });
      setMessage(result.message);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'خطا در ذخیره'); }
    finally { setSaving(''); }
  };

  const update = (target: Response, setTarget: (next: Response) => void, channel: Channel, patch: Partial<ChannelView>) => {
    setTarget({ ...target, channels: target.channels.map((row) => row.channel === channel ? { ...row, ...patch } : row) });
  };

  return (
    <Card className="overflow-hidden">
      <PanelHeader title="تنظیمات پیام‌رسان‌ها" description="سیاست Telegram و Bale در سه سطح سیستم، شرکت و کاربر" />
      <div className="space-y-5 p-5">
        {mode === 'system' && <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-xs leading-6 text-amber-100">
          اعلان می‌تواند روی هر دو پیام‌رسان فعال باشد؛ برای OTP فقط یک پیام‌رسان یا حالت خاموش انتخاب کنید. توکن ذخیره‌شده هرگز دوباره نمایش داده نمی‌شود.
        </div>}
        {message && <p className="rounded-xl border border-workspace-border bg-workspace-elevated px-3 py-2 text-xs text-workspace-muted">{message}</p>}
        {loading ? <Spinner label="در حال دریافت تنظیمات…" /> : mode === 'system' && system ? (
          <section className="space-y-3">
            {system.channels.map((row) => (
              <div key={row.channel} className="space-y-4 rounded-xl border border-workspace-border bg-workspace-elevated/45 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <strong className="text-sm text-workspace-ink">{row.displayName || labels[row.channel]}</strong>
                  <span className="text-[10px] text-workspace-soft">توکن: {row.botTokenMasked || (row.credentialConfigured ? 'تنظیم‌شده' : 'تنظیم نشده')}{` · وب‌هوک: ${row.webhookSecretMasked || 'تنظیم نشده'}`}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-xs text-workspace-muted">نام نمایشی
                    <input className="mt-2 w-full rounded-xl border border-workspace-borderStrong bg-workspace-elevated px-3 py-2 text-white" value={row.displayName || labels[row.channel]} onChange={(event) => update(system, setSystem, row.channel, { displayName: event.target.value })} />
                  </label>
                  <label className="text-xs text-workspace-muted">نام بات
                    <input dir="ltr" className="mt-2 w-full rounded-xl border border-workspace-borderStrong bg-workspace-elevated px-3 py-2 text-left text-white" placeholder="BotUsername" value={row.botUsername || ''} onChange={(event) => update(system, setSystem, row.channel, { botUsername: event.target.value || null })} />
                  </label>
                  <label className="text-xs text-workspace-muted">توکن جدید
                    <input dir="ltr" type="password" autoComplete="new-password" className="mt-2 w-full rounded-xl border border-workspace-borderStrong bg-workspace-elevated px-3 py-2 text-left text-white" placeholder={row.credentialConfigured ? 'برای حفظ توکن خالی بگذارید' : 'توکن را وارد کنید'} value={row.botToken || ''} onChange={(event) => update(system, setSystem, row.channel, { botToken: event.target.value || undefined })} />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-1">
                  <label className="text-xs text-workspace-muted">Webhook Secret
                    <span className="mt-1 block text-[10px] text-workspace-soft">Secret token used for {labels[row.channel]} webhook validation.</span>
                    <input dir="ltr" type="password" autoComplete="new-password" className="mt-2 w-full rounded-xl border border-workspace-borderStrong bg-workspace-elevated px-3 py-2 text-left text-white" placeholder={row.webhookSecretMasked ? `مقدار فعلی: ${row.webhookSecretMasked} — برای حفظ خالی بگذارید` : 'وب‌هوک سکرت را وارد کنید (حداقل ۸ کاراکتر)'} value={row.webhookSecret || ''} onChange={(event) => update(system, setSystem, row.channel, { webhookSecret: event.target.value || undefined })} />
                  </label>
                </div>
                <div className="flex flex-wrap gap-4">
                {([
                  ['enabled', 'فعال بودن پیام‌رسان'],
                  ['notificationEnabled', 'ارسال اعلان'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-xs text-workspace-muted">
                    <input type="checkbox" checked={Boolean(row[key])} onChange={(event) => update(system, setSystem, row.channel, { [key]: event.target.checked })} />{label}
                  </label>
                ))}
                </div>
              </div>
            ))}
            <label className="block text-xs text-workspace-muted">پیام‌رسان OTP
              <select className="mt-2 w-full rounded-xl border border-workspace-borderStrong bg-workspace-elevated px-3 py-2 text-white" value={system.channels.find((row) => row.otpEnabled)?.channel ?? ''} onChange={(event) => setSystem({ ...system, channels: system.channels.map((row) => ({ ...row, otpEnabled: row.channel === event.target.value })) })}>
                <option value="">خاموش</option>
                {system.channels.filter((row) => row.enabled).map((row) => <option key={row.channel} value={row.channel}>{row.displayName || labels[row.channel]}</option>)}
              </select>
            </label>
            <button className={btnPrimary} disabled={saving === 'system'} onClick={() => void saveSystem()}>{saving ? 'در حال ذخیره…' : 'ذخیره سیاست سراسری'}</button>
          </section>
        ) : personal ? (
          <div className="space-y-6">
            {isManager && company && (
              <section className="space-y-3">
                <h3 className="text-sm font-black text-white">سیاست اعلان شرکت</h3>
                {company.channels.map((row) => (
                  <PreferenceRow key={row.channel} row={row} title={labels[row.channel]} onChange={(next) => update(company, setCompany, row.channel, { notificationEnabled: value(next) })} />
                ))}
                <button className={btnPrimary} disabled={saving === 'company'} onClick={() => void saveCompany()}>{saving === 'company' ? 'در حال ذخیره…' : 'ذخیره سیاست شرکت'}</button>
              </section>
            )}
            <section className="space-y-3 border-t border-workspace-border pt-5">
              <h3 className="text-sm font-black text-white">ترجیحات شخصی اعلان</h3>
              {personal.channels.map((row) => (
                <PreferenceRow key={row.channel} row={row} title={labels[row.channel]} onChange={(next) => update(personal, setPersonal, row.channel, { notificationEnabled: value(next) })} />
              ))}
              <label className="block text-xs text-workspace-muted">
                کانال منتخب OTP (ذخیره برای P9)
                <select className="mt-2 w-full rounded-xl border border-workspace-borderStrong bg-workspace-elevated px-3 py-2 text-white" value={personal.otpChannel ?? ''} onChange={(event) => setPersonal({ ...personal, otpChannel: (event.target.value || null) as Channel | null })}>
                  <option value="">تنظیم نشده</option>
                  {personal.channels.filter((row) => row.otpAvailable).map((row) => <option key={row.channel} value={row.channel}>{labels[row.channel]}</option>)}
                </select>
              </label>
              <button className={btnPrimary} disabled={saving === 'personal'} onClick={() => void savePersonal()}>{saving === 'personal' ? 'در حال ذخیره…' : 'ذخیره ترجیحات شخصی'}</button>
            </section>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function PreferenceRow({ row, title, onChange }: { row: ChannelView; title: string; onChange: (choice: Choice) => void }) {
  return (
    <div className="grid gap-3 rounded-xl border border-workspace-border bg-workspace-elevated/45 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div>
        <strong className="text-sm text-workspace-ink">{title}</strong>
        <p className="mt-1 text-[10px] text-workspace-soft">
          وضعیت محاسبه‌شده: {row.effective ? 'مجاز' : 'غیرفعال'}{row.connected !== undefined ? ` · اتصال: ${row.connected ? 'تأییدشده' : 'ندارد'}` : ''}
        </p>
      </div>
      <select className="rounded-xl border border-workspace-borderStrong bg-workspace-elevated px-3 py-2 text-xs text-white" value={choice(row.notificationEnabled)} onChange={(event) => onChange(event.target.value as Choice)}>
        <option value="inherit">ارث‌بری (تنظیم نشده)</option>
        <option value="on">فعال</option>
        <option value="off">غیرفعال صریح</option>
      </select>
    </div>
  );
}
