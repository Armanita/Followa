'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, clearAuth, setAdminAuth } from '@/lib/api';
import { btnPrimary, Field, inputClass } from '@/components/ui';
import { CasesIcon, DashboardIcon, EmployeesIcon } from '@/components/workspace/icons';

type AdminLoginResponse = {
  token: string;
  admin: {
    id: string;
    username: string;
  };
};

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<AdminLoginResponse>('/auth/admin/login', { username, password });
      clearAuth();
      setAdminAuth(res.token, res.admin);
      router.replace('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ورود');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-workspace-canvas lg:grid-cols-[minmax(0,1fr)_minmax(440px,.78fr)]">
      <aside className="relative hidden overflow-hidden border-l border-workspace-border bg-workspace-shell p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-600/20 blur-3xl" />
        <div className="absolute -bottom-28 left-10 h-72 w-72 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-black text-white shadow-[0_16px_36px_rgba(124,77,255,.28)]">ف</span>
            <div>
              <p className="text-base font-black text-white">فالوآ</p>
              <p className="mt-0.5 text-[10px] text-workspace-soft">سامانه پیگیری و گردش کار سازمانی</p>
            </div>
          </div>
          <div className="mt-20 max-w-xl">
            <p className="text-[10px] font-bold tracking-wide text-brand-300">مدیریت سامانه</p>
            <h1 className="mt-4 text-4xl font-black leading-[1.55] tracking-tight text-white xl:text-5xl">نمای متمرکز شرکت‌ها و وضعیت کلی فالوآ.</h1>
            <p className="mt-5 max-w-lg text-sm leading-8 text-workspace-muted">این بخش برای مدیریت سطح سامانه، ایجاد شرکت‌ها و کنترل وضعیت دسترسی آن‌ها در نظر گرفته شده است.</p>
            <div className="mt-9 grid gap-3 sm:grid-cols-3">
              <Feature icon={<DashboardIcon className="h-4 w-4" />} title="نمای کلی" text="آمار پایه سامانه" />
              <Feature icon={<EmployeesIcon className="h-4 w-4" />} title="شرکت‌ها" text="مدیران و اعضا" />
              <Feature icon={<CasesIcon className="h-4 w-4" />} title="پرونده‌ها" text="تعداد پرونده‌های ثبت‌شده" />
            </div>
          </div>
        </div>
        <p className="relative text-[9px] text-workspace-soft">Followa System Administration</p>
      </aside>

      <main className="flex min-h-screen items-center justify-center p-5 sm:p-8 lg:p-12">
        <div className="w-full max-w-[430px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-sm font-black text-white">ف</span>
            <div>
              <p className="font-black text-white">فالوآ</p>
              <p className="text-[9px] text-workspace-soft">مدیریت سامانه</p>
            </div>
          </div>
          <div className="mb-7">
            <p className="text-[10px] font-bold text-brand-300">ورود مدیر سیستم</p>
            <h2 className="mt-2 text-2xl font-black text-white">مدیریت سامانه</h2>
            <p className="mt-2 text-xs leading-6 text-workspace-muted">برای ورود، نام کاربری و رمز عبور مدیر سیستم را وارد کنید.</p>
          </div>
          <form onSubmit={submit} className="space-y-4 rounded-2xl border border-workspace-border bg-workspace-surface p-5 shadow-workspace sm:p-6">
            <Field label="نام کاربری" required>
              <input
                className={inputClass}
                dir="ltr"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoFocus
              />
            </Field>
            <Field label="رمز عبور" required>
              <input
                type="password"
                className={inputClass}
                dir="ltr"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            {error && <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-3.5 py-2.5 text-xs text-red-200">{error}</div>}
            <button type="submit" disabled={loading || !username || !password} className={btnPrimary}>
              {loading ? 'در حال ورود…' : 'ورود به مدیریت سامانه'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-workspace-border bg-workspace-elevated/55 p-4">
      <span className="grid h-8 w-8 place-items-center rounded-lg border border-brand-400/20 bg-brand-400/10 text-brand-200">{icon}</span>
      <p className="mt-3 text-xs font-black text-white">{title}</p>
      <p className="mt-1 text-[9px] text-workspace-soft">{text}</p>
    </div>
  );
}
