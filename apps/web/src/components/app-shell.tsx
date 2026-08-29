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
    <nav className="dashboard-nav" aria-label="ناوبری اصلی">
      {nav.map((item) => {
        const base = item.href.split('?')[0];
        const active = pathname === base || (base !== '/dashboard' && pathname.startsWith(base));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setSidebarOpen(false)}
            className="dashboard-nav__link"
            data-active={active}
            aria-current={active ? 'page' : undefined}
          >
            <span className="dashboard-nav__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
            {item.href === '/notifications' && unread > 0 && (
              <span className="dashboard-nav__badge tnum">
                {unread.toLocaleString('fa-IR')}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="dashboard-shell orgawork-surface">
      <aside
        id="followa-sidebar"
        className="dashboard-sidebar"
        data-mobile-open={sidebarOpen}
        aria-label="ناوبری اصلی"
      >
        <div className="dashboard-sidebar__top">
          <BrandHeader />
          <button
            type="button"
            className="dashboard-sidebar__close dashboard-icon-button"
            onClick={() => setSidebarOpen(false)}
            aria-label="بستن منو"
          >
            ×
          </button>
        </div>

        {NavList}

        <div className="dashboard-sidebar__footer">
          <span>حساب فعال</span>
          <strong>
            {user.firstName} {user.lastName}
          </strong>
          <span>{isManager ? 'مدیر شرکت' : 'کارمند'}</span>
          <button type="button" onClick={logout} className="dashboard-logout">
            <span aria-hidden="true">↪</span>
            خروج از حساب
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="dashboard-backdrop"
          aria-label="بستن منو"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="dashboard-workspace">
        <header className="dashboard-header">
          <div className="dashboard-header__identity">
            <button
              type="button"
              className="dashboard-header__menu-button dashboard-icon-button"
              onClick={() => setSidebarOpen(true)}
              aria-label="باز کردن منو"
              aria-controls="followa-sidebar"
              aria-expanded={sidebarOpen}
            >
              ☰
            </button>
            <div className="dashboard-header__organization">
              <span>فضای کاری</span>
              <strong>{isManager ? 'مدیریت شرکت' : 'پنل کارمند'}</strong>
            </div>
          </div>

          <div className="dashboard-header__actions">
            {!isManager && (
              <Link
                href="/notifications"
                className="dashboard-icon-link"
                aria-label="اعلان‌ها"
              >
                <span aria-hidden="true">🔔</span>
                {unread > 0 && (
                  <span className="dashboard-header__badge tnum">
                    {unread.toLocaleString('fa-IR')}
                  </span>
                )}
              </Link>
            )}
            <div className="dashboard-user-chip">
              <div className="dashboard-user-chip__copy">
                <strong>
                  {user.firstName} {user.lastName}
                </strong>
                <span>{isManager ? 'مدیر شرکت' : 'کارمند'}</span>
              </div>
              <div className="dashboard-user-chip__avatar" aria-hidden="true">
                {user.firstName.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        <main id="dashboard-content" className="dashboard-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}

function BrandHeader() {
  return (
    <Link className="dashboard-brand" href="/dashboard">
      <span className="dashboard-brand__mark">ف</span>
      <span className="dashboard-brand__copy">
        <strong>فالوآ</strong>
        <span>سیستم پیگیری داخلی شرکت</span>
      </span>
    </Link>
  );
}
