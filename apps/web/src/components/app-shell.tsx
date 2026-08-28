'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api, clearAuth, getCachedUser, getToken } from '@/lib/api';
import {
  BellIcon,
  ChartIcon,
  ClockIcon,
  CloseIcon,
  FolderIcon,
  HandshakeIcon,
  HomeIcon,
  InboxIcon,
  LogoutIcon,
  MenuIcon,
  SettingsIcon,
  UserIcon,
  UsersIcon,
} from '@/components/workspace/icons';

interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  role: 'COMPANY_MANAGER' | 'EMPLOYEE' | null;
  companyId: string | null;
}

interface NavEntry {
  href: string;
  label: string;
  icon: ReactNode;
}

const NAV_MANAGER: NavEntry[] = [
  { href: '/dashboard', label: 'داشبورد', icon: <HomeIcon /> },
  { href: '/cases', label: 'پرونده‌ها', icon: <FolderIcon /> },
  { href: '/customers', label: 'مشتریان', icon: <HandshakeIcon /> },
  { href: '/employees', label: 'کارکنان', icon: <UsersIcon /> },
  { href: '/reports', label: 'گزارش‌ها', icon: <ChartIcon /> },
  { href: '/settings', label: 'تنظیمات', icon: <SettingsIcon /> },
];

const NAV_EMPLOYEE: NavEntry[] = [
  { href: '/dashboard', label: 'داشبورد', icon: <HomeIcon /> },
  { href: '/cases?mine=true', label: 'کارهای من', icon: <FolderIcon /> },
  { href: '/assignments', label: 'ارجاع‌های جدید', icon: <InboxIcon /> },
  { href: '/reminders', label: 'یادآوری‌ها', icon: <ClockIcon /> },
  { href: '/notifications', label: 'اعلان‌ها', icon: <BellIcon /> },
  { href: '/profile', label: 'پروفایل', icon: <UserIcon /> },
];

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="tnum flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white shadow-sm">
      {count.toLocaleString('fa-IR')}
    </span>
  );
}

function BrandBlock() {
  return (
    <div className="flex items-center gap-3 border-b border-workspace-shell-border px-5 py-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-base font-black text-white shadow-lg shadow-blue-950/30">
        ف
      </div>
      <div className="min-w-0">
        <p className="text-base font-extrabold leading-none text-white">فالوآ</p>
        <p className="mt-1.5 truncate text-[11px] text-workspace-shell-muted">فضای عملیاتی پیگیری شرکت</p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

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

  useEffect(() => {
    if (!sidebarOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const timer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [sidebarOpen]);

  if (!user) return null;

  const isManager = user.role === 'COMPANY_MANAGER';
  const nav = isManager ? NAV_MANAGER : NAV_EMPLOYEE;

  const logout = () => {
    clearAuth();
    router.replace('/login');
  };

  const navList = (
    <nav aria-label="ناوبری اصلی" className="flex flex-col gap-1 p-3">
      {nav.map((item) => {
        const base = item.href.split('?')[0];
        const active = pathname === base || (base !== '/dashboard' && pathname.startsWith(`${base}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setSidebarOpen(false)}
            className={`group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50 ${
              active
                ? 'bg-workspace-shell-active text-white ring-1 ring-inset ring-white/10'
                : 'text-workspace-shell-muted hover:bg-workspace-shell-hover hover:text-white'
            }`}
          >
            {active && <span className="absolute inset-y-2 right-0 w-0.5 rounded-l-full bg-brand-400" aria-hidden="true" />}
            <span className="flex h-5 w-5 shrink-0 items-center justify-center [&>svg]:h-5 [&>svg]:w-5">{item.icon}</span>
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.href === '/notifications' ? <UnreadBadge count={unread} /> : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-workspace-canvas text-workspace-ink">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-l border-workspace-shell-border bg-workspace-shell shadow-xl shadow-slate-950/10 lg:flex">
        <BrandBlock />
        <div className="flex-1 overflow-y-auto">{navList}</div>
        <div className="border-t border-workspace-shell-border p-3">
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-950/35 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/35"
          >
            <LogoutIcon className="h-5 w-5" />
            <span>خروج از حساب</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[1px]" aria-hidden="true" />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="منوی اصلی"
            className="absolute right-0 top-0 flex h-full w-[min(19rem,88vw)] flex-col border-l border-workspace-shell-border bg-workspace-shell shadow-workspace-pop"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-end px-3 pt-3">
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setSidebarOpen(false)}
                aria-label="بستن منو"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-workspace-shell-muted transition hover:bg-workspace-shell-hover hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <BrandBlock />
            <div className="flex-1 overflow-y-auto">{navList}</div>
            <div className="border-t border-workspace-shell-border p-3">
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-950/35 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/35"
              >
                <LogoutIcon className="h-5 w-5" />
                <span>خروج از حساب</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-workspace-shell-border bg-workspace-shell px-4 py-3 shadow-sm lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="باز کردن منو"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-workspace-shell-muted transition hover:bg-workspace-shell-hover hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <span className="font-extrabold text-white">فالوآ</span>
          <span className="mr-auto truncate text-sm font-medium text-workspace-shell-muted">
            {user.firstName} {user.lastName}
          </span>
        </header>

        <header className="sticky top-0 z-20 hidden h-16 items-center justify-between border-b border-workspace-shell-border bg-workspace-shell px-8 shadow-sm lg:flex">
          <div className="text-sm text-workspace-shell-muted">فضای عملیاتی پیگیری و اجرای کار</div>
          <div className="flex items-center gap-4">
            {!isManager && (
              <Link
                href="/notifications"
                aria-label="اعلان‌ها"
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-workspace-shell-muted transition hover:bg-workspace-shell-hover hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50"
              >
                <BellIcon className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute -left-2 -top-2">
                    <UnreadBadge count={unread} />
                  </span>
                )}
              </Link>
            )}
            <div className="text-left">
              <p className="text-sm font-semibold text-white">
                {user.firstName} {user.lastName}
              </p>
              <p className="mt-0.5 text-xs text-workspace-shell-muted">{isManager ? 'مدیر شرکت' : 'کارمند'}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 font-bold text-white ring-1 ring-inset ring-white/10" aria-hidden="true">
              {user.firstName.charAt(0)}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1280px] flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
