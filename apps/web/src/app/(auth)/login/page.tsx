'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, setAuth, clearAuth } from '@/lib/api';
import { btnPrimary, Field, inputClass, Toast } from '@/components/ui';
import Link from 'next/link';

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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-bl from-brand-50 via-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-black text-white shadow-pop">
            ف
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">فالوآ</h1>
          <p className="mt-1 text-sm text-slate-500">سیستم پیگیری و گردش کار داخلی شرکت</p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-3xl bg-white p-6 shadow-card ring-1 ring-slate-200/70 sm:p-8"
        >
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

          <p className="pt-1 text-center text-sm text-slate-500">
            رمز عبور ندارید؟{' '}
            <Link href="/otp" className="font-semibold text-brand-600 hover:underline">
              ثبت‌نام با کد یکبارمصرف
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
