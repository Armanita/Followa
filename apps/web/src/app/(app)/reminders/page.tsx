'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, EmptyState, ErrorState, Spinner, Toast } from '@/components/ui';
import { faDateTime } from '@/lib/jalali';

interface ReminderRow {
  id: string;
  caseId: string;
  remindAt: string;
  note: string | null;
  status: string;
  completedAt: string | null;
  case: { id: string; title: string; number: number; status: string };
}

export default function RemindersPage() {
  const [items, setItems] = useState<ReminderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'ACTIVE' | 'TODAY' | 'DONE' | 'EXPIRED'>('ACTIVE');
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const showToast = (message: string, tone: 'success' | 'error') => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    try {
      setError('');
      // due-check generates REMINDER_DUE notifications for anything overdue
      await api.get('/reminders/due-check').catch(() => {});
      let res: { items: ReminderRow[] };
      if (tab === 'TODAY') {
        res = await api.get('/reminders?today=true&status=ACTIVE');
      } else {
        res = await api.get(`/reminders?status=${tab}`);
      }
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const complete = async (r: ReminderRow) => {
    const result = window.prompt('نتیجه این پیگیری را ثبت کنید (روی پرونده نیز درج می‌شود):', r.note ?? '');
    if (result === null) return;
    try {
      await api.post(`/reminders/${r.id}/complete`, { result: result || undefined });
      showToast('یادآوری انجام شد', 'success');
      void load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'خطا', 'error');
    }
  };

  const tabs = [
    { key: 'ACTIVE', label: 'فعال' },
    { key: 'TODAY', label: 'امروز' },
    { key: 'DONE', label: 'انجام‌شده' },
    { key: 'EXPIRED', label: 'گذشته' },
  ] as const;

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.message} tone={toast.tone} />}
      <div>
        <h1 className="text-xl font-extrabold">یادآوری‌ها</h1>
        <p className="mt-0.5 text-sm text-slate-500">هیچ پیگیری‌ای فراموش نمی‌شود</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition ${
              tab === t.key ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            title="یادآوری‌ای در این بخش نیست"
            hint="از صفحه جزئیات هر پرونده می‌توانید یادآوری جدید بسازید."
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {items.map((r) => {
            const overdue = r.status === 'ACTIVE' && new Date(r.remindAt) < new Date();
            return (
              <Card key={r.id} className={`p-4 ${overdue ? 'ring-red-200' : ''}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xl">{overdue ? '🔥' : r.status === 'DONE' ? '✅' : '⏰'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.note || r.case.title}</p>
                    <p className="tnum mt-0.5 text-xs text-slate-400">
                      {faDateTime(r.remindAt)}
                      {' · '}
                      <Link href={`/cases/${r.caseId}`} className="hover:text-brand-600">
                        #{r.case.number.toLocaleString('fa-IR')} {r.case.title}
                      </Link>
                    </p>
                  </div>
                  {overdue && (
                    <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-600">
                      سررسید گذشته
                    </span>
                  )}
                  {r.status === 'ACTIVE' && (
                    <button
                      onClick={() => complete(r)}
                      className="shrink-0 rounded-xl bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      انجام شد + ثبت نتیجه
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
