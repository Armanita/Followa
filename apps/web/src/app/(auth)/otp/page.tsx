'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, clearAuth, setAuth } from '@/lib/api';
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

  const stepIndex = ['mobile', 'code', 'password'].indexOf(step);

  return (
    <div className="followa-auth">
      <section className="followa-auth__form-panel">
        <div className="followa-auth__brand" aria-label="فالوآ">
          <span className="followa-auth__brand-mark">ف</span>
          <span className="followa-auth__brand-copy">
            <strong>فالوآ</strong>
            <span>سیستم پیگیری داخلی شرکت</span>
          </span>
        </div>

        <div className="followa-auth__content">
          <div className="followa-auth__heading">
            <p className="followa-auth__eyebrow">فعال‌سازی حساب</p>
            <h1>ثبت‌نام و تعیین رمز عبور</h1>
            <p>از شماره موبایلی استفاده کنید که مدیر شرکت برای حساب شما ثبت کرده است.</p>
          </div>

          <div className="followa-auth__card">
            <ol className="followa-auth__stepper" aria-label="مراحل فعال‌سازی حساب">
              {['شماره موبایل', 'کد تأیید', 'رمز عبور'].map((label, index) => (
                <li
                  key={label}
                  className="followa-auth__step"
                  data-active={index <= stepIndex}
                  aria-current={index === stepIndex ? 'step' : undefined}
                >
                  <span className="followa-auth__step-index tnum">
                    {(index + 1).toLocaleString('fa-IR')}
                  </span>
                  <span>{label}</span>
                </li>
              ))}
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

            <p className="followa-auth__footer-link">
              قبلاً رمز دارید؟ <Link href="/login">ورود با رمز</Link>
            </p>
          </div>
        </div>
      </section>

      <aside className="followa-auth__visual" aria-hidden="true">
        <div className="followa-auth__visual-content">
          <span>راه‌اندازی امن حساب</span>
          <h2>یک بار فعال‌سازی؛ بعد از آن ورود مستقیم به فضای کاری</h2>
          <p>
            فرایند تأیید شماره و ساخت رمز همان رفتار قبلی Followa را حفظ می‌کند و فقط در قالب بصری
            یکپارچه‌ی جدید ارائه می‌شود.
          </p>
        </div>
      </aside>
    </div>
  );
}
