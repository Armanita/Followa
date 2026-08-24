'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, EmptyState, ErrorState, Spinner } from '@/components/ui';
import { faDateTime } from '@/lib/jalali';
import { NOTIFICATION_LABELS } from '@/lib/labels';

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkType: string | null;
  linkId: string | null;
  readAt: string | null;
  createdAt: string;
}

const ICONS: Record<string, string> = {
  CASE_ASSIGNED: '📥',
  CASE_ACCEPTED: '✅',
  CASE_REJECTED: '⛔',
  REMINDER_DUE: '⏰',
  CASE_COMPLETED: '🏁',
  CASE_UPDATED: '📝',
};

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const res = await api.get<{ items: NotificationRow[] }>('/notifications?limit=100');
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = async (n: NotificationRow) => {
    if (n.readAt) return;
    await api.post(`/notifications/${n.id}/read`).catch(() => {});
    void load();
  };

  const markAll = async () => {
    await api.post('/notifications/read-all').catch(() => {});
    void load();
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">اعلان‌ها</h1>
          <p className="mt-0.5 text-sm text-slate-500">رویدادهای مرتبط با شما</p>
        </div>
        {items.some((n) => !n.readAt) && (
          <button onClick={markAll} className="text-sm font-semibold text-brand-600 hover:underline">
            علامت‌گذاری همه به‌عنوان خوانده‌شده
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <Card>
          <EmptyState title="اعلانی ندارید" hint="رویدادهای ارجاع، رد، تکمیل و یادآوری اینجا نمایش داده می‌شوند." />
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const content = (
              <div
                className={`flex items-start gap-3 rounded-2xl p-4 transition ${
                  n.readAt
                    ? 'bg-white ring-1 ring-slate-200/70'
                    : 'bg-brand-50/70 ring-1 ring-brand-200'
                }`}
              >
                <span className="mt-0.5 text-lg">{ICONS[n.type] ?? '🔔'}</span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${n.readAt ? 'font-medium' : 'font-bold'} text-slate-800`}>
                    {n.title}
                    <span className="mr-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-normal text-slate-500">
                      {NOTIFICATION_LABELS[n.type] ?? n.type}
                    </span>
                  </p>
                  {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</p>}
                  <p className="tnum mt-1 text-[11px] text-slate-400">{faDateTime(n.createdAt)}</p>
                </div>
                {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
              </div>
            );
            return n.linkType === 'CASE' && n.linkId ? (
              <Link key={n.id} href={`/cases/${n.linkId}`} onClick={() => markRead(n)}>
                {content}
              </Link>
            ) : (
              <button key={n.id} onClick={() => markRead(n)} className="block w-full text-right">
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
