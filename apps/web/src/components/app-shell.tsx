'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, clearAuth, getCachedUser, getToken } from '@/lib/api';

interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  role: 'COMPANY_MANAGER' | 'EMPLOYEE' | null;
  companyId: string | null;
}

const NAV_MANAGER = [
  { href: '/dashboard', label: 'داشبورد', icon: '🏠' },
  { href: '/cases', label: 'پرونده‌ها', icon: '📁' },
  { href: '/customers', label: 'مشتریان', icon: '🤝' },
  { href: '/employees', label: 'کارکنان', icon: '👥' },
  { href: '/reports', label: 'گزارش‌ها', icon: '📊' },
  { href: '/settings', label: 'تنظیمات', icon: '⚙️' },
];

const NAV_EMPLOYEE = [
  { href: '/dashboard', label: 'داشبورد', icon: '🏠' },
  { href: '/cases?mine=true', label: 'کارهای من', icon: '📁' },
  { href: '/assignments', label: 'ارجاع‌های جدید', icon: '📥' },
  { href: '/reminders', label: 'یادآوری‌ها', icon: '⏰' },
  { href: '/notifications', label: 'اعلان‌ها', icon: '🔔' },
  { href: '/profile', label: 'پروفایل', icon: '👤' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    const cached = getCachedUser<SessionUser>();
    if (!cached) {
      router.replace('/login');
      return;
    }
    setUser(cached);
    api
      .get<{ unreadCount: number }>('/notifications?unread=true&limit=1')
      .then((r) => setUnread(r.unreadCount))
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    const t = setInterval(() => {
      api
        .get<{ unreadCount: number }>('/notifications?unread=true&limit=1')
        .then((r) => setUnread(r.unreadCount))
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  if (!user) return null;

  const isManager = user.role === 'COMPANY_MANAGER';
  const nav = isManager ? NAV_MANAGER : NAV_EMPLOYEE;

  const logout = () => {
    clearAuth();
    router.replace('/login');
  };

  const NavList = (
    <nav className="flex flex-col gap-1 p-3">
      {nav.map((item) => {
        const base = item.href.split('?')[0];
        const active = pathname === base || (base !== '/dashboard' && pathname.startsWith(base));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
              active
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="text-base">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {item.href === '/notifications' && unread > 0 && (
              <span className="tnum flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                {unread.toLocaleString('fa-IR')}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-l border-slate-200 bg-white lg:flex">
        <BrandHeader />
        {NavList}
        <div className="mt-auto border-t border-slate-100 p-3">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            <span>🚪</span> خروج از حساب
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" />
          <aside
            className="absolute right-0 top-0 flex h-full w-72 flex-col bg-white shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <BrandHeader />
            {NavList}
            <div className="mt-auto border-t border-slate-100 p-3">
              <button
                onClick={logout}
                className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <span>🚪</span> خروج از حساب
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500"
            aria-label="منو"
          >
            ☰
          </button>
          <span className="font-extrabold text-brand-700">فالوآ</span>
          <span className="mr-auto text-sm font-medium text-slate-600">
            {user.firstName} {user.lastName}
          </span>
        </header>
        <header className="hidden items-center justify-between border-b border-slate-200 bg-white/90 px-8 py-4 backdrop-blur lg:flex">
          <div />
          <div className="flex items-center gap-4">
            {!isManager && (
              <Link
                href="/notifications"
                className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
              >
                🔔
                {unread > 0 && (
                  <span className="absolute -left-1 -top-1 tnum flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unread.toLocaleString('fa-IR')}
                  </span>
                )}
              </Link>
            )}
            <div className="text-left">
              <p className="text-sm font-semibold">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-slate-400">{isManager ? 'مدیر شرکت' : 'کارمند'}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-700">
              {user.firstName.charAt(0)}
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function BrandHeader() {
  return (
    <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 font-black text-white">
        ف
      </div>
      <div>
        <p className="text-lg font-extrabold leading-none text-brand-800">فالوآ</p>
        <p className="mt-1 text-[11px] text-slate-400">سیستم پیگیری داخلی شرکت</p>
      </div>
    </div>
  );
}
