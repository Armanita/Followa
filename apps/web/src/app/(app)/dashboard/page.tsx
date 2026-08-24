'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, getCachedUser, getToken } from '@/lib/api';
import {
  Card,
  EmptyState,
  ErrorState,
  PriorityBadge,
  Spinner,
  StatCard,
  StatusBadge,
} from '@/components/ui';
import { CaseStatusChart, ActivityTimeline } from '@/components/timeline';
import { faDateTime, faDuration, isLate, toFa } from '@/lib/jalali';

interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  role: 'COMPANY_MANAGER' | 'EMPLOYEE' | null;
}

export default function DashboardPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const u = getCachedUser<SessionUser>();
      if (!u) return;
      setUser(u);
      const path =
        u.role === 'COMPANY_MANAGER' ? '/dashboard/manager' : '/dashboard/employee';
      const res = await api.get<any>(path);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در دریافت داشبورد');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (getToken()) void load();
  }, [load]);

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const greeting = `سلام ${user?.firstName ?? ''} 👋`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">{greeting}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {user?.role === 'COMPANY_MANAGER'
            ? 'نمای کلی پرونده‌ها و فعالیت کارکنان'
            : 'خلاصه کارهای و یادآوری‌های امروز شما'}
        </p>
      </div>

      {/* ---- Manager dashboard ---- */}
      {user?.role === 'COMPANY_MANAGER' && data.cards && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <StatCard label="کل پرونده‌ها" value={toFa(data.cards.totalCases)} />
            <StatCard label="باز" value={toFa(data.cards.openCases)} tone="default" />
            <StatCard label="در حال انجام" value={toFa(data.cards.inProgress)} />
            <StatCard label="در انتظار پذیرش" value={toFa(data.cards.waitingAcceptance)} tone="warning" />
            <StatCard label="عقب‌افتاده" value={toFa(data.cards.lateCases)} tone="danger" />
            <StatCard label="کارکنان فعال" value={toFa(data.cards.activeEmployees)} tone="success" />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-bold">پرونده‌های فوری</h2>
                <Link href="/cases?priority=HIGH" className="text-xs font-medium text-brand-600 hover:underline">
                  مشاهده همه
                </Link>
              </div>
              {data.urgentCases.length === 0 ? (
                <EmptyState title="پرونده فوری وجود ندارد" hint="همه چیز تحت کنترل است." />
              ) : (
                <div className="-mx-2 space-y-1">
                  {data.urgentCases.map((c: any) => (
                    <Link
                      key={c.id}
                      href={`/cases/${c.id}`}
                      className="block rounded-xl px-3 py-2.5 transition hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-2">
                        <PriorityBadge priority={c.priority} />
                        <span className="truncate text-sm font-medium">{c.title}</span>
                        {isLate(c.dueDate, c.status) && (
                          <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                            عقب‌افتاده
                          </span>
                        )}
                        <span className="mr-auto hidden shrink-0 sm:block">
                          <StatusBadge status={c.status} />
                        </span>
                      </div>
                      <p className="tnum mt-1 text-xs text-slate-400">
                        مسئول: {c.currentOwner ? `${c.currentOwner.firstName} ${c.currentOwner.lastName}` : '—'}
                        {c.caseType && ` · ${c.caseType.name}`}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="mb-4 font-bold">وضعیت پرونده‌ها</h2>
              <CaseStatusChart data={data.statusChart} />
              <div className="mt-6 border-t border-slate-100 pt-4">
                <h3 className="mb-3 text-sm font-semibold">افراد در حال کار</h3>
                {data.activeWorkers.length === 0 ? (
                  <p className="text-sm text-slate-400">الان کسی روی پرونده‌ای کار نمی‌کند.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {data.activeWorkers.map((w: any, i: number) => (
                      <li key={i} className="flex items-center gap-2.5 text-sm">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                        </span>
                        <span className="font-medium">
                          {w.user.firstName} {w.user.lastName}
                        </span>
                        <span className="mr-auto max-w-[45%] truncate text-xs text-slate-400">
                          {w.case.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </div>

          <Card className="p-5">
            <h2 className="mb-4 font-bold">فعالیت‌های اخیر</h2>
            <ActivityTimeline items={data.recentActivities} />
          </Card>
        </>
      )}

      {/* ---- Employee dashboard ---- */}
      {user?.role !== 'COMPANY_MANAGER' && data.cards && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            <StatCard label="کارهای من" value={toFa(data.cards.myCases)} />
            <StatCard label="یادآوری‌های امروز" value={toFa(data.cards.todayReminders)} tone="warning" />
            <StatCard label="ارجاع‌های جدید" value={toFa(data.cards.newAssignments)} tone="danger" />
            <StatCard label="کار فعال" value={toFa(data.cards.activeWork)} />
            <StatCard label="تکمیل‌شده" value={toFa(data.cards.completedCases)} tone="success" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-bold">یادآوری‌های امروز</h2>
                <Link href="/reminders" className="text-xs font-medium text-brand-600 hover:underline">
                  همه یادآوری‌ها
                </Link>
              </div>
              {data.remindersToday.length === 0 ? (
                <EmptyState title="یادآوری‌ای برای امروز ندارید" hint="یادآوری‌ها از جزئیات پرونده ساخته می‌شوند." />
              ) : (
                <ul className="space-y-3">
                  {data.remindersToday.map((r: any) => (
                    <li key={r.id}>
                      <Link
                        href={`/cases/${r.caseId}`}
                        className="flex items-start gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-brand-200 hover:bg-brand-50/40"
                      >
                        <span className="mt-0.5 text-lg">⏰</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{r.note || r.case.title}</p>
                          <p className="mt-0.5 text-xs text-slate-400">{faDateTime(r.remindAt)}</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="mb-4 font-bold">کارهای در جریان شما</h2>
              {data.activeWork.length === 0 ? (
                <EmptyState
                  title="نشست کاری فعالی ندارید"
                  hint="از جزئیات هر پرونده می‌توانید «شروع کار» را بزنید."
                  action={
                    <Link href="/cases?mine=true" className="mt-3 text-sm font-semibold text-brand-600 hover:underline">
                      رفتن به کارهای من ←
                    </Link>
                  }
                />
              ) : (
                <ul className="space-y-3">
                  {data.activeWork.map((w: any) => (
                    <li key={w.sessionId}>
                      <Link
                        href={`/cases/${w.caseId}`}
                        className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 transition hover:bg-emerald-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{w.caseTitle}</p>
                          <p className="tnum mt-0.5 text-xs text-emerald-700">
                            شروع از {faDateTime(w.startedAt)}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">
                          در حال کار
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card className="p-5">
            <h2 className="mb-4 font-bold">آخرین رویدادهای پرونده‌های شما</h2>
            <ActivityTimeline items={data.recentActivities} />
          </Card>
        </>
      )}
    </div>
  );
}
