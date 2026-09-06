'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { btnPrimary, Field, inputClass } from '@/components/ui';

type Step = 'mobile' | 'code' | 'password' | 'done';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('mobile');
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const requestCode = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      // Generic response: the server never reveals whether the account exists.
      await api.post('/auth/forgot-password/request', { mobile });
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally { setLoading(false); }
  };

  const verifyCode = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await api.post<{ resetToken: string }>('/auth/forgot-password/verify', { mobile, code });
      setResetToken(res.resetToken);
      setStep('password');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally { setLoading(false); }
  };

  const resetPassword = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (password !== password2) { setError('تکرار رمز عبور مطابقت ندارد'); return; }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password/reset', { mobile, resetToken, password });
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally { setLoading(false); }
  };

  const goLogin = () => router.replace('/login');

  const steps = ['mobile', 'code', 'password'] as const;
  const current = steps.indexOf(step === 'done' ? 'password' : step);

  return (
    <div className="flex min-h-screen items-center justify-center bg-workspace-canvas p-5">
      <div className="w-full max-w-[520px]">
        <div className="mb-7 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-base font-black text-white shadow-[0_12px_28px_rgba(124,77,255,.25)]">ف</span>
          <div>
            <p className="font-black text-white">بازیابی رمز عبور فالوآ</p>
            <p className="mt-0.5 text-[9px] text-workspace-soft">ارسال کد یکبارمصرف و تعیین رمز عبور جدید</p>
          </div>
        </div>
        <div className="rounded-2xl border border-workspace-border bg-workspace-surface p-5 shadow-workspace sm:p-6">
          <ol className="mb-7 grid grid-cols-3 gap-2">
            {['شماره موبایل', 'کد تأیید', 'رمز جدید'].map((label, index) => (
              <li key={label} className={`rounded-xl border p-3 ${index <= current ? 'border-brand-400/20 bg-brand-400/10' : 'border-workspace-border bg-workspace-elevated/45'}`}>
                <span className={`tnum grid h-6 w-6 place-items-center rounded-lg text-[10px] font-black ${index <= current ? 'bg-brand-600 text-white' : 'bg-workspace-border text-workspace-soft'}`}>{(index + 1).toLocaleString('fa-IR')}</span>
                <p className={`mt-2 text-[10px] font-semibold ${index <= current ? 'text-brand-100' : 'text-workspace-soft'}`}>{label}</p>
              </li>
            ))}
          </ol>

          {step === 'mobile' && (
            <form onSubmit={requestCode} className="space-y-4">
              <Field label="شماره موبایل" required>
                <input className={`${inputClass} tnum text-left`} dir="ltr" inputMode="numeric" placeholder="09123456789" value={mobile} onChange={(event) => setMobile(event.target.value)} autoFocus />
              </Field>
              <p className="text-[10px] leading-5 text-workspace-soft">در صورت وجود حساب برای این شماره، کد بازیابی ارسال می‌شود.</p>
              <AuthError message={error} />
              <button type="submit" disabled={loading} className={btnPrimary}>{loading ? 'در حال ارسال…' : 'دریافت کد بازیابی'}</button>
            </form>
          )}

          {step === 'code' && (
            <form onSubmit={verifyCode} className="space-y-4">
              <div className="rounded-xl border border-workspace-border bg-workspace-elevated/55 p-3 text-[11px] leading-6 text-workspace-muted">
                در صورت وجود حساب، کد ۶ رقمی برای <span className="tnum font-bold text-white">{mobile}</span> ارسال شد.
              </div>
              <Field label="کد تأیید" required>
                <input className={`${inputClass} tnum text-center text-lg tracking-[0.5em]`} dir="ltr" inputMode="numeric" maxLength={6} placeholder="——————" value={code} onChange={(event) => setCode(event.target.value)} autoFocus />
              </Field>
              <AuthError message={error} />
              <button type="submit" disabled={loading} className={btnPrimary}>{loading ? 'در حال بررسی…' : 'تأیید کد'}</button>
              <button type="button" onClick={() => setStep('mobile')} className="w-full text-center text-[11px] text-workspace-muted hover:text-white">تغییر شماره موبایل</button>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={resetPassword} className="space-y-4">
              <Field label="رمز عبور جدید" required>
                <input type="password" className={inputClass} dir="ltr" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus />
              </Field>
              <Field label="تکرار رمز عبور" required>
                <input type="password" className={inputClass} dir="ltr" value={password2} onChange={(event) => setPassword2(event.target.value)} />
              </Field>
              <p className="text-[10px] text-workspace-soft">رمز عبور حداقل ۸ کاراکتر باشد.</p>
              <AuthError message={error} />
              <button type="submit" disabled={loading} className={btnPrimary}>{loading ? 'در حال ثبت…' : 'ثبت رمز جدید'}</button>
            </form>
          )}

          {step === 'done' && (
            <div className="space-y-4 text-center">
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-xs font-bold text-emerald-200">رمز عبور شما با موفقیت تغییر کرد.</div>
              <button type="button" onClick={goLogin} className={btnPrimary}>ورود به فالوآ</button>
            </div>
          )}

          <p className="mt-6 border-t border-workspace-border pt-4 text-center text-[11px] text-workspace-muted">
            رمز عبور را به یاد دارید؟ <Link href="/login" className="font-bold text-brand-300 hover:text-brand-200">ورود با رمز</Link>
            {' · '}<Link href="/otp" className="font-bold text-brand-300 hover:text-brand-200">فعال‌سازی حساب</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function AuthError({ message }: { message: string }) { return message ? <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-3.5 py-2.5 text-xs text-red-200">{message}</div> : null; }
