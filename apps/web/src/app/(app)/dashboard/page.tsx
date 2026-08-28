'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, getCachedUser, getToken } from '@/lib/api';
import { Card, EmptyState, ErrorState, Spinner, StatCard } from '@/components/ui';
import { ActivityTimeline } from '@/components/timeline';
import { ManagerDashboard } from '@/components/workspace/manager-dashboard';
import { faDateTime, toFa } from '@/lib/jalali';

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
      const path = u.role === 'COMPANY_MANAGER' ? '/dashboard/manager' : '/dashboard/employee';
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

  if (user?.role === 'COMPANY_MANAGER' && data.cards) {
    return <ManagerDashboard firstName={user.firstName} data={data} />;
  }

  const greeting = `سلام ${user?.firstName ?? ''} 👋`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">{greeting}</h1>
        <p className="mt-1 text-sm text-slate-500">خلاصه کارهای و یادآوری‌های امروز شما</p>
      </div>

      {data.cards && (
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
                          <p className="tnum mt-0.5 text-xs text-emerald-700">شروع از {faDateTime(w.startedAt)}</p>
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
