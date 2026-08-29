'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, ErrorState, Spinner } from '@/components/ui';
import { ReportsIcon } from '@/components/workspace/icons';
import { Avatar, PageHeader, PanelHeader } from '@/components/workspace/page';
import { faDuration, toFa } from '@/lib/jalali';

interface ReportRow {
  membershipId: string;
  user: { id: string; fullName: string; mobile: string };
  role: string;
  isActive: boolean;
  ownedActiveCases: number;
  completedCases: number;
  workSeconds30d: number;
  sessions30d: number;
  pendingAssignments: number;
}

export default function ReportsPage() {
  const [items, setItems] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ items: ReportRow[] }>('/reports/employees').then((r) => setItems(r.items)).catch((err) => setError(err instanceof Error ? err.message : 'خطا')).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} />;

  const employees = items.filter((item) => item.role !== 'COMPANY_MANAGER');
  const maxWork = Math.max(1, ...employees.map((item) => item.workSeconds30d));
  const activeCases = employees.reduce((sum, item) => sum + item.ownedActiveCases, 0);
  const completed = employees.reduce((sum, item) => sum + item.completedCases, 0);
  const pending = employees.reduce((sum, item) => sum + item.pendingAssignments, 0);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="تحلیل سازمان" title="گزارش کارکنان" description="نمای عملیاتی ۳۰ روز گذشته بر پایه پرونده‌های جاری، تکمیل‌شده و داده نشست‌های کاری ثبت‌شده." icon={<ReportsIcon className="h-5 w-5" />} meta={`${toFa(employees.length)} کارمند در گزارش`} />

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4"><p className="text-[10px] text-workspace-soft">پرونده فعال تیم</p><p className="tnum mt-2 text-2xl font-black text-white">{toFa(activeCases)}</p></Card>
        <Card className="p-4"><p className="text-[10px] text-workspace-soft">تکمیل‌شده</p><p className="tnum mt-2 text-2xl font-black text-emerald-300">{toFa(completed)}</p></Card>
        <Card className="p-4"><p className="text-[10px] text-workspace-soft">ارجاع در انتظار</p><p className="tnum mt-2 text-2xl font-black text-amber-300">{toFa(pending)}</p></Card>
      </div>

      <Card className="overflow-hidden">
        <PanelHeader title="زمان کار ثبت‌شده" description="این نمودار داده تاریخی نشست‌های کاری ۳۰ روز گذشته را نشان می‌دهد و با زمان صرف‌شده اعلامی در نتایج یکی نیست." />
        <div className="space-y-4 p-5">
          {employees.map((item) => (
            <div key={item.membershipId}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px]"><span className="font-semibold text-workspace-muted">{item.user.fullName}</span><span className="tnum text-workspace-soft">{faDuration(item.workSeconds30d)}</span></div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-workspace-elevated"><div className="h-full rounded-full bg-gradient-to-l from-brand-500 to-blue-500" style={{ width: `${item.workSeconds30d === 0 ? 0 : Math.max(4, (item.workSeconds30d / maxWork) * 100)}%` }} /></div>
            </div>
          ))}
          {employees.every((item) => item.workSeconds30d === 0) && <p className="py-3 text-center text-xs text-workspace-soft">نشست کاری‌ای در این بازه ثبت نشده است.</p>}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <PanelHeader title="جزئیات عملکرد تیم" description="اعداد مستقیماً از گزارش فعلی API فالوآ خوانده می‌شوند." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-right text-xs">
            <thead><tr className="border-b border-workspace-border bg-workspace-elevated/45 text-[10px] text-workspace-soft"><th className="px-5 py-3 font-semibold">کارمند</th><th className="px-4 py-3 font-semibold">وضعیت</th><th className="px-4 py-3 font-semibold">فعال</th><th className="px-4 py-3 font-semibold">تکمیل</th><th className="px-4 py-3 font-semibold">انتظار پذیرش</th><th className="px-4 py-3 font-semibold">نشست ۳۰ روز</th><th className="px-4 py-3 font-semibold">زمان ثبت‌شده</th></tr></thead>
            <tbody className="divide-y divide-workspace-border">
              {items.map((item) => (
                <tr key={item.membershipId} className="transition hover:bg-workspace-hover/55">
                  <td className="px-5 py-3.5"><div className="flex items-center gap-3"><Avatar name={item.user.fullName} size="sm" /><div><p className="font-bold text-workspace-ink">{item.user.fullName}</p><p className="tnum mt-0.5 text-[9px] text-workspace-soft" dir="ltr">{item.user.mobile}</p></div></div></td>
                  <td className="px-4 py-3.5"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${item.isActive ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-red-400/20 bg-red-400/10 text-red-300'}`}>{item.isActive ? 'فعال' : 'غیرفعال'}</span></td>
                  <td className="tnum px-4 py-3.5 font-black text-white">{toFa(item.ownedActiveCases)}</td><td className="tnum px-4 py-3.5 text-emerald-300">{toFa(item.completedCases)}</td><td className="tnum px-4 py-3.5 text-amber-300">{toFa(item.pendingAssignments)}</td><td className="tnum px-4 py-3.5 text-workspace-muted">{toFa(item.sessions30d)}</td><td className="px-4 py-3.5 text-workspace-muted">{faDuration(item.workSeconds30d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
