'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, ErrorState, Spinner } from '@/components/ui';
import { ReportsIcon } from '@/components/workspace/icons';
import { Avatar, PageHeader, PanelHeader } from '@/components/workspace/page';
import { CustomerCaseReport } from '@/components/workspace/customer-case-report';
import { toFa } from '@/lib/jalali';

interface ReportRow {
  membershipId: string;
  user: { id: string; fullName: string; mobile: string };
  role: string;
  isActive: boolean;
  ownedActiveCases: number;
  completedCases: number;
  pendingAssignments: number;
}

type ReportsTab = 'employees' | 'customer';

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportsTab>('employees');

  const tabs = [
    { key: 'employees' as const, label: 'گزارش کارکنان' },
    { key: 'customer' as const, label: 'گزارش مشتری' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="تحلیل سازمان"
        title={tab === 'employees' ? 'گزارش کارکنان' : 'گزارش مشتری'}
        description={
          tab === 'employees'
            ? 'نمای عملیاتی تیم بر پایه پرونده‌های فعال، تکمیل‌شده و ارجاع‌های در انتظار پذیرش.'
            : 'پرونده‌های هر مشتری به تفکیک وضعیت، بازه زمانی، کارمند و نوع پرونده.'
        }
        icon={<ReportsIcon className="h-5 w-5" />}
      />

      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-workspace-border bg-workspace-surface p-2 shadow-card">
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-semibold transition ${tab === item.key ? 'bg-brand-600 text-white shadow-[0_8px_20px_rgba(109,54,237,.18)]' : 'text-workspace-muted hover:bg-workspace-hover hover:text-white'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'customer' ? <CustomerCaseReport /> : <EmployeesReport />}
    </div>
  );
}

function EmployeesReport() {
  const [items, setItems] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<{ items: ReportRow[] }>('/reports/employees')
      .then((response) => setItems(response.items))
      .catch((err) => setError(err instanceof Error ? err.message : 'خطا در دریافت گزارش'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} />;

  const employees = items.filter((item) => item.role !== 'COMPANY_MANAGER');
  const activeCases = employees.reduce((sum, item) => sum + item.ownedActiveCases, 0);
  const completed = employees.reduce((sum, item) => sum + item.completedCases, 0);
  const pending = employees.reduce((sum, item) => sum + item.pendingAssignments, 0);
  const maxCaseLoad = Math.max(
    1,
    ...employees.map((item) => item.ownedActiveCases + item.completedCases + item.pendingAssignments),
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-[10px] text-workspace-soft">پرونده فعال تیم</p>
          <p className="tnum mt-2 text-2xl font-black text-white">{toFa(activeCases)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] text-workspace-soft">تکمیل‌شده</p>
          <p className="tnum mt-2 text-2xl font-black text-emerald-300">{toFa(completed)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] text-workspace-soft">ارجاع در انتظار</p>
          <p className="tnum mt-2 text-2xl font-black text-amber-300">{toFa(pending)}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <PanelHeader
          title="بار عملیاتی تیم"
          description="مقایسه پرونده‌های فعال، تکمیل‌شده و ارجاع‌های منتظر پاسخ؛ بدون اتکا به تایمر یا نشست کاری قدیمی."
        />
        <div className="space-y-5 p-5">
          {employees.map((item) => {
            const total = item.ownedActiveCases + item.completedCases + item.pendingAssignments;
            const width = total === 0 ? 0 : Math.max(4, (total / maxCaseLoad) * 100);
            return (
              <div key={item.membershipId}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={item.user.fullName} size="sm" />
                    <div>
                      <p className="text-[11px] font-bold text-workspace-ink">{item.user.fullName}</p>
                      <p className="mt-0.5 text-[9px] text-workspace-soft">
                        {toFa(item.ownedActiveCases)} فعال · {toFa(item.completedCases)} تکمیل · {toFa(item.pendingAssignments)} انتظار
                      </p>
                    </div>
                  </div>
                  <span className="tnum text-[10px] font-bold text-workspace-muted">{toFa(total)} پرونده/ارجاع</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-workspace-elevated">
                  <div
                    className="h-full rounded-full bg-gradient-to-l from-brand-500 to-blue-500"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
          {employees.length === 0 && (
            <p className="py-5 text-center text-xs text-workspace-soft">کارمندی برای گزارش وجود ندارد.</p>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <PanelHeader title="جزئیات عملکرد تیم" description="اعداد مستقیماً از گزارش جاری API فالوآ خوانده می‌شوند." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-right text-xs">
            <thead>
              <tr className="border-b border-workspace-border bg-workspace-elevated/45 text-[10px] text-workspace-soft">
                <th className="px-5 py-3 font-semibold">کارمند</th>
                <th className="px-4 py-3 font-semibold">وضعیت</th>
                <th className="px-4 py-3 font-semibold">پرونده فعال</th>
                <th className="px-4 py-3 font-semibold">تکمیل‌شده</th>
                <th className="px-4 py-3 font-semibold">انتظار پذیرش</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-workspace-border">
              {employees.map((item) => (
                <tr key={item.membershipId} className="transition hover:bg-workspace-hover/55">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={item.user.fullName} size="sm" />
                      <div>
                        <p className="font-bold text-workspace-ink">{item.user.fullName}</p>
                        <p className="tnum mt-0.5 text-[9px] text-workspace-soft" dir="ltr">{item.user.mobile}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${item.isActive ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-red-400/20 bg-red-400/10 text-red-300'}`}>
                      {item.isActive ? 'فعال' : 'غیرفعال'}
                    </span>
                  </td>
                  <td className="tnum px-4 py-3.5 font-black text-white">{toFa(item.ownedActiveCases)}</td>
                  <td className="tnum px-4 py-3.5 text-emerald-300">{toFa(item.completedCases)}</td>
                  <td className="tnum px-4 py-3.5 text-amber-300">{toFa(item.pendingAssignments)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
