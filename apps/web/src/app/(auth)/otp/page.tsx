'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, setAuth, clearAuth } from '@/lib/api';
import { btnPrimary, Field, inputClass } from '@/components/ui';

type Step = 'mobile' | 'code' | 'password';

export default function OtpPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('mobile');
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/otp/request', { mobile });
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{ resetToken: string }>('/auth/otp/verify', { mobile, code });
      setResetToken(res.resetToken);
      setStep('password');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setLoading(false);
    }
  };

  const createPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== password2) {
      setError('تکرار رمز عبور مطابقت ندارد');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/password', { mobile, resetToken, password });
      // auto login after setup
      const res = await api.post<{ token: string; user: unknown }>('/auth/login', {
        mobile,
        password,
      });
      clearAuth();
      setAuth(res.token, res.user);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-bl from-brand-50 via-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-extrabold text-slate-900">ثبت‌نام / تعیین رمز عبور</h1>
          <p className="mt-1 text-sm text-slate-500">با شماره موبایلی که مدیر برای شما ثبت کرده است</p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-slate-200/70 sm:p-8">
          {/* stepper */}
          <ol className="mb-6 flex items-center justify-between text-xs">
            {['شماره موبایل', 'کد تأیید', 'رمز عبور'].map((label, i) => {
              const idx = ['mobile', 'code', 'password'].indexOf(step);
              const active = i <= idx;
              return (
                <li key={label} className="flex flex-1 items-center gap-2">
                  <span
                    className={`tnum flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {(i + 1).toLocaleString('fa-IR')}
                  </span>
                  <span className={active ? 'font-semibold text-slate-700' : 'text-slate-400'}>
                    {label}
                  </span>
                  {i < 2 && <span className="mx-1 h-px flex-1 bg-slate-200" />}
                </li>
              );
            })}
          </ol>

          {step === 'mobile' && (
            <form onSubmit={requestCode} className="space-y-4">
              <Field label="شماره موبایل" required>
                <input
                  className={`${inputClass} tnum text-left`}
                  dir="ltr"
                  inputMode="numeric"
                  placeholder="09123456789"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  autoFocus
                />
              </Field>
              {error && (
                <div className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</div>
              )}
              <button type="submit" disabled={loading} className={btnPrimary}>
                {loading ? 'در حال ارسال…' : 'دریافت کد تأیید'}
              </button>
            </form>
          )}

          {step === 'code' && (
            <form onSubmit={verifyCode} className="space-y-4">
              <p className="text-sm text-slate-500">
                کد ۶ رقمی به شماره <span className="tnum font-medium">{mobile}</span> ارسال شد.
                {process.env.NEXT_PUBLIC_SHOW_OTP === 'true' && (
                  <span className="text-xs text-slate-400"> (حالت توسعه: کد در لاگ سرور)</span>
                )}
              </p>
              <Field label="کد تأیید" required>
                <input
                  className={`${inputClass} tnum text-center text-lg tracking-[0.5em]`}
                  dir="ltr"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="——————"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoFocus
                />
              </Field>
              {error && (
                <div className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</div>
              )}
              <button type="submit" disabled={loading} className={btnPrimary}>
                {loading ? 'بررسی…' : 'تأیید کد'}
              </button>
              <button
                type="button"
                onClick={() => setStep('mobile')}
                className="w-full text-center text-sm text-slate-500 hover:text-slate-700"
              >
                تغییر شماره
              </button>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={createPassword} className="space-y-4">
              <Field label="رمز عبور جدید" required>
                <input
                  type="password"
                  className={inputClass}
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                />
              </Field>
              <Field label="تکرار رمز عبور" required>
                <input
                  type="password"
                  className={inputClass}
                  dir="ltr"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                />
              </Field>
              <p className="text-xs text-slate-400">رمز عبور حداقل ۸ کاراکتر باشد.</p>
              {error && (
                <div className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</div>
              )}
              <button type="submit" disabled={loading} className={btnPrimary}>
                {loading ? 'در حال ثبت…' : 'ساخت رمز و ورود'}
              </button>
            </form>
          )}

          <p className="mt-6 border-t border-slate-100 pt-4 text-center text-sm text-slate-500">
            قبلاً رمز دارید؟{' '}
            <Link href="/login" className="font-semibold text-brand-600 hover:underline">
              ورود با رمز
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
