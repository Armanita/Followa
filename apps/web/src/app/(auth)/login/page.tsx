'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, clearAuth, setAuth } from '@/lib/api';
import { btnPrimary, Field, inputClass } from '@/components/ui';

interface LoginResponse {
  token: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    role: 'COMPANY_MANAGER' | 'EMPLOYEE' | null;
  };
}

export default function LoginPage() {
  const router = useRouter();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<LoginResponse>('/auth/login', { mobile, password });
      clearAuth();
      setAuth(res.token, res.user);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ورود');
    } finally {
      setLoading(false);
    }
  };

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
            <p className="followa-auth__eyebrow">ورود به فضای کاری</p>
            <h1>خوش آمدید</h1>
            <p>برای ادامه، با شماره موبایل و رمز عبور حساب سازمانی خود وارد شوید.</p>
          </div>

          <form onSubmit={submit} className="followa-auth__card space-y-4">
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
            <Field label="رمز عبور" required>
              <input
                type="password"
                className={inputClass}
                dir="ltr"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>

            {error && (
              <div className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</div>
            )}

            <button type="submit" disabled={loading} className={btnPrimary}>
              {loading ? 'در حال ورود…' : 'ورود'}
            </button>

            <p className="followa-auth__footer-link">
              رمز عبور ندارید؟{' '}
              <Link href="/otp">ثبت‌نام با کد یکبارمصرف</Link>
            </p>
          </form>
        </div>
      </section>

      <aside className="followa-auth__visual" aria-hidden="true">
        <div className="followa-auth__visual-content">
          <span>فضای کاری یکپارچه</span>
          <h2>پیگیری پرونده‌ها، مسئولیت‌ها و نتیجه‌ها در یک جریان روشن</h2>
          <p>
            فالوآ برای تیم‌هایی ساخته شده که می‌خواهند هر ارجاع، پیگیری و نتیجه قابل مشاهده و قابل
            پیگیری باقی بماند.
          </p>
        </div>
      </aside>
    </div>
  );
}
