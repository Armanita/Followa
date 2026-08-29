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
      const currentUser = getCachedUser<SessionUser>();
      if (!currentUser) return;
      setUser(currentUser);
      const path = currentUser.role === 'COMPANY_MANAGER' ? '/dashboard/manager' : '/dashboard/employee';
      const response = await api.get<any>(path);
      setData(response);
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
  if (!data || !user) return null;

  if (user.role === 'COMPANY_MANAGER') {
    if (!data.cards) return <ErrorState message="اطلاعات داشبورد مدیریت کامل دریافت نشد." onRetry={load} />;
    return <ManagerDashboard data={data} firstName={user.firstName} />;
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-workspace-border pb-5">
        <p className="text-[10px] font-semibold text-workspace-soft">فضای کاری من</p>
        <h1 className="mt-1 text-2xl font-black text-white">سلام، {user.firstName}</h1>
        <p className="mt-2 text-xs text-workspace-muted">خلاصه کارها، ارجاع‌ها و یادآوری‌های امروز شما</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="کارهای من" value={toFa(data.cards.myCases)} />
        <StatCard label="یادآوری‌های امروز" value={toFa(data.cards.todayReminders)} tone="warning" />
        <StatCard label="ارجاع‌های جدید" value={toFa(data.cards.newAssignments)} tone="danger" />
        <StatCard label="تکمیل‌شده" value={toFa(data.cards.completedCases)} tone="success" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-white">یادآوری‌های امروز</h2>
              <p className="mt-1 text-[10px] text-workspace-soft">پیگیری‌هایی که امروز نیاز به اقدام شما دارند</p>
            </div>
            <Link href="/reminders" className="text-[11px] font-bold text-brand-300 hover:text-brand-200">همه یادآوری‌ها</Link>
          </div>
          {data.remindersToday.length === 0 ? (
            <EmptyState title="یادآوری‌ای برای امروز ندارید" hint="یادآوری بعدی هنگام ثبت نتیجه پرونده قابل تنظیم است." />
          ) : (
            <ul className="space-y-2.5">
              {data.remindersToday.map((reminder: any) => (
                <li key={reminder.id}>
                  <Link href={`/cases/${reminder.caseId}`} className="flex items-start gap-3 rounded-xl border border-workspace-border bg-workspace-elevated/60 p-3 transition hover:border-brand-400/25 hover:bg-workspace-hover">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-workspace-ink">{reminder.note || reminder.case.title}</p>
                      <p className="mt-1 text-[10px] text-workspace-soft">{faDateTime(reminder.remindAt)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-black text-white">میانبرهای کاری</h2>
          <p className="mt-1 text-[10px] leading-5 text-workspace-soft">عملیات روزانه از خود پرونده انجام می‌شود: نتیجه، زمان صرف‌شده، یادآوری بعدی، فایل و انتقال.</p>
          <div className="mt-4 space-y-2">
            <DashboardLink href="/cases?mine=true" label="مشاهده کارهای من" />
            <DashboardLink href="/assignments" label="بررسی ارجاع‌ها" />
            <DashboardLink href="/reminders" label="مدیریت یادآوری‌ها" />
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-5 text-sm font-black text-white">آخرین رویدادهای پرونده‌های شما</h2>
        <ActivityTimeline items={data.recentActivities} />
      </Card>
    </div>
  );
}

function DashboardLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl border border-workspace-border bg-workspace-elevated/60 px-3.5 py-3 text-xs font-bold text-workspace-ink transition hover:border-brand-400/25 hover:bg-workspace-hover"
    >
      <span>{label}</span>
      <span className="text-workspace-soft">←</span>
    </Link>
  );
}
