'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { clearAdminAuth, getCachedAdmin, getToken } from '@/lib/api';
import {
  CloseIcon,
  DashboardIcon,
  LogoutIcon,
  MenuIcon,
} from '@/components/workspace/icons';

type AdminSession = {
  id: string;
  username: string;
};

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState<AdminSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const token = getToken();
    const cached = getCachedAdmin<AdminSession>();
    if (!token || !cached) {
      router.replace('/admin/login');
      return;
    }
    setAdmin(cached);
  }, [router]);

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

  if (!admin) return null;

  const logout = () => {
    clearAdminAuth();
    router.replace('/admin/login');
  };

  const active = pathname === '/admin';

  const sidebar = (
    <>
      <div className="flex h-[78px] items-center gap-3 border-b border-workspace-border px-5">
        <Link href="/admin" onClick={() => setSidebarOpen(false)} className="flex min-w-0 flex-1 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-base font-black text-white shadow-[0_10px_28px_rgba(124,77,255,.28)]">ف</span>
          <span className="min-w-0">
            <strong className="block text-[15px] font-black text-white">فالوآ</strong>
            <span className="block truncate text-[10px] text-workspace-soft">مدیریت سامانه</span>
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

      <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="ناوبری مدیر سیستم">
        <p className="mb-2 px-3 text-[11px] font-semibold tracking-wide text-workspace-soft">مدیریت سامانه</p>
        <Link
          href="/admin"
          onClick={() => setSidebarOpen(false)}
          className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold transition ${
            active
              ? 'bg-brand-500/15 text-white ring-1 ring-brand-400/20'
              : 'text-workspace-muted hover:bg-workspace-hover hover:text-white'
          }`}
          aria-current={active ? 'page' : undefined}
        >
          {active && <span className="absolute inset-y-2 right-0 w-0.5 rounded-full bg-brand-400" />}
          <DashboardIcon className={`h-[18px] w-[18px] ${active ? 'text-brand-300' : 'text-workspace-soft group-hover:text-workspace-muted'}`} />
          <span>داشبورد سامانه</span>
        </Link>
      </nav>

      <div className="m-3 rounded-2xl border border-workspace-border bg-workspace-elevated/80 p-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-brand-400/20 bg-brand-500/10 text-xs font-black text-brand-200">س</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-white">مدیر سیستم</p>
            <p className="mt-0.5 truncate text-[10px] text-workspace-soft" dir="ltr">{admin.username}</p>
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
            <p className="text-[10px] font-semibold text-workspace-soft">فضای مدیریت</p>
            <p className="mt-0.5 text-xs font-bold text-workspace-muted">مرکز مدیریت سامانه فالوآ</p>
          </div>
          <div className="mr-auto flex items-center gap-3">
            <div className="text-left">
              <p className="text-xs font-bold text-white">مدیر سیستم</p>
              <p className="mt-0.5 text-[10px] text-workspace-soft" dir="ltr">{admin.username}</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-workspace-borderStrong bg-workspace-elevated text-[11px] font-black text-brand-200">س</div>
          </div>
        </header>

        <header className="sticky top-0 z-30 flex h-[62px] items-center gap-3 border-b border-workspace-border bg-workspace-shell/95 px-4 backdrop-blur-xl lg:hidden">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-workspace-border text-workspace-muted"
            aria-label="باز کردن منو"
            aria-expanded={sidebarOpen}
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-xs font-black text-white">ف</span>
          <div className="min-w-0">
            <p className="text-xs font-black text-white">فالوآ</p>
            <p className="truncate text-[9px] text-workspace-soft">مدیریت سامانه</p>
          </div>
          <div className="mr-auto grid h-9 w-9 place-items-center rounded-lg border border-workspace-border bg-workspace-elevated text-[10px] font-black text-brand-200">س</div>
        </header>

        <main className="mx-auto w-full max-w-[1480px] p-4 sm:p-5 lg:p-7 xl:p-8">{children}</main>
      </div>
    </div>
  );
}
