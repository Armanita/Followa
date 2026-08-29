'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, clearAuth, getCachedUser, getToken } from '@/lib/api';
import {
  AssignmentsIcon,
  BellIcon,
  CasesIcon,
  CloseIcon,
  CustomersIcon,
  DashboardIcon,
  EmployeesIcon,
  LogoutIcon,
  MenuIcon,
  NotificationsIcon,
  ProfileIcon,
  RemindersIcon,
  ReportsIcon,
  SettingsIcon,
} from '@/components/workspace/icons';

interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  role: 'COMPANY_MANAGER' | 'EMPLOYEE' | null;
  companyId: string | null;
}

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

type NavGroup = { label: string; items: NavItem[] };

const NAV_MANAGER: NavGroup[] = [
  {
    label: 'مدیریت عملیات',
    items: [
      { href: '/dashboard', label: 'داشبورد مدیریت', icon: DashboardIcon },
      { href: '/cases', label: 'پرونده‌ها', icon: CasesIcon },
      { href: '/customers', label: 'مشتریان', icon: CustomersIcon },
    ],
  },
  {
    label: 'سازمان و تحلیل',
    items: [
      { href: '/employees', label: 'کارکنان', icon: EmployeesIcon },
      { href: '/reports', label: 'گزارش‌ها', icon: ReportsIcon },
      { href: '/settings', label: 'تنظیمات', icon: SettingsIcon },
    ],
  },
];

const NAV_EMPLOYEE: NavGroup[] = [
  {
    label: 'فضای کاری من',
    items: [
      { href: '/dashboard', label: 'داشبورد من', icon: DashboardIcon },
      { href: '/cases?mine=true', label: 'کارهای من', icon: CasesIcon },
      { href: '/assignments', label: 'ارجاع‌های جدید', icon: AssignmentsIcon },
    ],
  },
  {
    label: 'پیگیری',
    items: [
      { href: '/reminders', label: 'یادآوری‌ها', icon: RemindersIcon },
      { href: '/notifications', label: 'اعلان‌ها', icon: NotificationsIcon },
      { href: '/profile', label: 'پروفایل', icon: ProfileIcon },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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
    const timer = window.setInterval(() => {
      api
        .get<{ unreadCount: number }>('/notifications?unread=true&limit=1')
        .then((r) => setUnread(r.unreadCount))
        .catch(() => {});
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const closeMobileNavigation = useCallback(() => {
    setSidebarOpen(false);
    window.requestAnimationFrame(() => menuButtonRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMobileNavigation();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [closeMobileNavigation, sidebarOpen]);

  if (!user) return null;

  const isManager = user.role === 'COMPANY_MANAGER';
  const groups = isManager ? NAV_MANAGER : NAV_EMPLOYEE;
  const fullName = `${user.firstName} ${user.lastName}`.trim();
  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.trim();

  const logout = () => {
    clearAuth();
    router.replace('/login');
  };

  const navContent = (
    <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="ناوبری اصلی">
      {groups.map((group) => (
        <div key={group.label} className="mb-6 last:mb-0">
          <p className="mb-2 px-3 text-[11px] font-semibold tracking-wide text-workspace-soft">
            {group.label}
          </p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const base = item.href.split('?')[0];
              const active = pathname === base || (base !== '/dashboard' && pathname.startsWith(base));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold transition ${
                    active
                      ? 'bg-brand-500/15 text-white ring-1 ring-brand-400/20'
                      : 'text-workspace-muted hover:bg-workspace-hover hover:text-white'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  {active && <span className="absolute inset-y-2 right-0 w-0.5 rounded-full bg-brand-400" />}
                  <Icon className={`h-[18px] w-[18px] ${active ? 'text-brand-300' : 'text-workspace-soft group-hover:text-workspace-muted'}`} />
                  <span className="flex-1">{item.label}</span>
                  {item.href === '/notifications' && unread > 0 && (
                    <span className="tnum grid min-w-5 place-items-center rounded-full bg-workspace-red px-1.5 py-0.5 text-[10px] font-black text-white">
                      {unread.toLocaleString('fa-IR')}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const sidebar = (
    <>
      <div className="flex h-[78px] items-center gap-3 border-b border-workspace-border px-5">
        <Link href="/dashboard" onClick={() => setSidebarOpen(false)} className="flex min-w-0 flex-1 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-base font-black text-white shadow-[0_10px_28px_rgba(124,77,255,.28)]">ف</span>
          <span className="min-w-0">
            <strong className="block text-[15px] font-black text-white">فالوآ</strong>
            <span className="block truncate text-[10px] text-workspace-soft">مدیریت پیگیری و گردش کار</span>
          </span>
        </Link>
        <button
          ref={closeButtonRef}
          type="button"
          className="grid h-9 w-9 place-items-center rounded-lg border border-workspace-border text-workspace-muted transition hover:bg-workspace-hover hover:text-white lg:hidden"
          onClick={closeMobileNavigation}
          aria-label="بستن منو"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>

      {navContent}

      <div className="m-3 rounded-2xl border border-workspace-border bg-workspace-elevated/80 p-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-brand-400/20 bg-brand-500/10 text-xs font-black text-brand-200">
            {initials || user.firstName.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-white">{fullName}</p>
            <p className="mt-0.5 text-[10px] text-workspace-soft">{isManager ? 'مدیر شرکت' : 'کارمند'}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-workspace-red/20 bg-workspace-red/5 text-xs font-semibold text-red-300 transition hover:bg-workspace-red/10"
        >
          <LogoutIcon className="h-4 w-4" />
          خروج از حساب
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-workspace-canvas text-workspace-ink">
      <aside className="fixed inset-y-0 right-0 z-40 hidden w-[272px] flex-col border-l border-workspace-border bg-workspace-shell lg:flex">
        {sidebar}
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-[3px]"
            onClick={closeMobileNavigation}
            aria-label="بستن منو"
          />
          <aside className="absolute inset-y-0 right-0 flex w-[min(86vw,304px)] flex-col border-l border-workspace-border bg-workspace-shell shadow-pop">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="min-h-screen lg:pr-[272px]">
        <header className="sticky top-0 z-30 hidden h-[72px] items-center border-b border-workspace-border bg-workspace-canvas/90 px-7 backdrop-blur-xl lg:flex">
          <div>
            <p className="text-[10px] font-semibold text-workspace-soft">فضای کاری</p>
            <p className="mt-0.5 text-xs font-bold text-workspace-muted">{isManager ? 'مرکز مدیریت شرکت' : 'فضای کاری کارمند'}</p>
          </div>
          <div className="mr-auto flex items-center gap-3">
            {!isManager && (
              <Link
                href="/notifications"
                className="relative grid h-10 w-10 place-items-center rounded-xl border border-workspace-border bg-workspace-surface text-workspace-muted transition hover:border-workspace-borderStrong hover:bg-workspace-hover hover:text-white"
                aria-label="اعلان‌ها"
              >
                <BellIcon className="h-[18px] w-[18px]" />
                {unread > 0 && (
                  <span className="tnum absolute -left-1 -top-1 grid min-w-[18px] place-items-center rounded-full border-2 border-workspace-canvas bg-workspace-red px-1 py-0.5 text-[9px] font-black text-white">
                    {unread.toLocaleString('fa-IR')}
                  </span>
                )}
              </Link>
            )}
            <div className="h-7 w-px bg-workspace-border" />
            <div className="text-left">
              <p className="text-xs font-bold text-white">{fullName}</p>
              <p className="mt-0.5 text-[10px] text-workspace-soft">{isManager ? 'مدیر شرکت' : 'کارمند'}</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-workspace-borderStrong bg-workspace-elevated text-[11px] font-black text-brand-200">
              {initials || user.firstName.charAt(0)}
            </div>
          </div>
        </header>

        <header className="sticky top-0 z-30 flex h-[62px] items-center gap-3 border-b border-workspace-border bg-workspace-shell/95 px-4 backdrop-blur-xl lg:hidden">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-workspace-border text-workspace-muted"
            aria-label="باز کردن منو"
            aria-controls="followa-mobile-sidebar"
            aria-expanded={sidebarOpen}
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-xs font-black text-white">ف</span>
          <div className="min-w-0">
            <p className="text-xs font-black text-white">فالوآ</p>
            <p className="truncate text-[9px] text-workspace-soft">{isManager ? 'مدیریت شرکت' : 'فضای کاری من'}</p>
          </div>
          <div className="mr-auto grid h-9 w-9 place-items-center rounded-lg border border-workspace-border bg-workspace-elevated text-[10px] font-black text-brand-200">
            {initials || user.firstName.charAt(0)}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1480px] p-4 sm:p-5 lg:p-7 xl:p-8">{children}</main>
      </div>
    </div>
  );
}
