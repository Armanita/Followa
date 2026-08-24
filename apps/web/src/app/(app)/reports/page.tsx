'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, ErrorState, Spinner } from '@/components/ui';
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
    api
      .get<{ items: ReportRow[] }>('/reports/employees')
      .then((r) => setItems(r.items))
      .catch((err) => setError(err instanceof Error ? err.message : 'خطا'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} />;

  const maxWork = Math.max(1, ...items.map((r) => r.workSeconds30d));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold">گزارش کارکنان</h1>
        <p className="mt-0.5 text-sm text-slate-500">عملکرد ۳۰ روز گذشته</p>
      </div>

      {/* bar chart of work time */}
      <Card className="p-5">
        <h2 className="mb-4 font-bold">زمان کار ثبت‌شده (۳۰ روز)</h2>
        <div className="space-y-3">
          {items
            .filter((r) => r.role !== 'COMPANY_MANAGER')
            .map((r) => (
              <div key={r.membershipId}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">{r.user.fullName}</span>
                  <span className="tnum text-slate-400">{faDuration(r.workSeconds30d)}</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-l from-brand-500 to-brand-400"
                    style={{ width: `${Math.max(4, (r.workSeconds30d / maxWork) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          {items.every((r) => r.workSeconds30d === 0) && (
            <p className="py-3 text-center text-sm text-slate-400">
              هنوز نشست کاری‌ای در ۳۰ روز گذشته ثبت نشده است.
            </p>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-right text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-xs text-slate-500">
                <th className="px-4 py-3 font-semibold">کارمند</th>
                <th className="px-4 py-3 font-semibold">وضعیت</th>
                <th className="px-4 py-3 font-semibold">پرونده‌های فعال</th>
                <th className="px-4 py-3 font-semibold">تکمیل‌شده</th>
                <th className="px-4 py-3 font-semibold">در انتظار پذیرش او</th>
                <th className="px-4 py-3 font-semibold">نشست کاری (۳۰ روز)</th>
                <th className="px-4 py-3 font-semibold">زمان کار (۳۰ روز)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((r) => (
                <tr key={r.membershipId} className="transition hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{r.user.fullName}</p>
                    <p className="tnum text-xs text-slate-400" dir="ltr">{r.user.mobile}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        r.isActive ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-red-50 text-red-600 ring-red-200'
                      }`}
                    >
                      {r.isActive ? 'فعال' : 'غیرفعال'}
                    </span>
                  </td>
                  <td className="tnum px-4 py-3 font-bold">{toFa(r.ownedActiveCases)}</td>
                  <td className="tnum px-4 py-3">{toFa(r.completedCases)}</td>
                  <td className="tnum px-4 py-3">{toFa(r.pendingAssignments)}</td>
                  <td className="tnum px-4 py-3">{toFa(r.sessions30d)}</td>
                  <td className="px-4 py-3">{faDuration(r.workSeconds30d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
