'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, EmptyState, ErrorState, Spinner } from '@/components/ui';
import { ActivityIcon, AlertIcon, CheckIcon, ClockIcon, NotificationsIcon } from '@/components/workspace/icons';
import { PageHeader } from '@/components/workspace/page';
import { faDateTime } from '@/lib/jalali';
import { NOTIFICATION_LABELS } from '@/lib/labels';

interface NotificationRow { id: string; type: string; title: string; body: string | null; linkType: string | null; linkId: string | null; readAt: string | null; createdAt: string; }

function NotificationGlyph({ type }: { type: string }) {
  const common = 'h-4 w-4';
  if (type === 'REMINDER_DUE') return <ClockIcon className={common} />;
  if (type === 'CASE_REJECTED') return <AlertIcon className={common} />;
  if (type === 'CASE_ACCEPTED' || type === 'CASE_COMPLETED') return <CheckIcon className={common} />;
  if (type === 'CASE_UPDATED') return <ActivityIcon className={common} />;
  return <NotificationsIcon className={common} />;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationRow[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = useCallback(async () => { try { setError(''); const res = await api.get<{ items: NotificationRow[] }>('/notifications?limit=100'); setItems(res.items); } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const markRead = async (notification: NotificationRow) => { if (notification.readAt) return; await api.post(`/notifications/${notification.id}/read`).catch(() => {}); void load(); };
  const markAll = async () => { await api.post('/notifications/read-all').catch(() => {}); void load(); };
  if (loading) return <Spinner />; if (error) return <ErrorState message={error} onRetry={load} />;
  const unreadCount = items.filter((item) => !item.readAt).length;

  return <div className="space-y-5"><PageHeader eyebrow="مرکز اعلان" title="اعلان‌ها" description="رویدادهای مرتبط با ارجاع، پیگیری، تکمیل و تغییر پرونده‌ها را در یک جریان مرور کنید." icon={<NotificationsIcon className="h-5 w-5" />} meta={<span className={unreadCount ? 'text-brand-200' : ''}>{unreadCount.toLocaleString('fa-IR')} خوانده‌نشده از {items.length.toLocaleString('fa-IR')} اعلان</span>} actions={unreadCount > 0 ? <button onClick={markAll} className="rounded-xl border border-workspace-borderStrong bg-workspace-elevated px-4 py-2.5 text-xs font-semibold text-workspace-muted transition hover:bg-workspace-hover hover:text-white">علامت‌گذاری همه به‌عنوان خوانده‌شده</button> : undefined} />
    {items.length === 0 ? <Card><EmptyState title="اعلانی ندارید" hint="رویدادهای ارجاع، رد، تکمیل و یادآوری اینجا نمایش داده می‌شوند." /></Card> : <Card className="overflow-hidden"><div className="divide-y divide-workspace-border">{items.map((notification) => { const unread = !notification.readAt; const content = <div className={`flex items-start gap-3 px-4 py-4 transition sm:px-5 ${unread ? 'bg-brand-400/[.045]' : 'hover:bg-workspace-hover/55'}`}><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${unread ? 'border-brand-400/20 bg-brand-400/10 text-brand-200' : 'border-workspace-border bg-workspace-elevated text-workspace-soft'}`}><NotificationGlyph type={notification.type} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className={`text-xs text-workspace-ink ${unread ? 'font-black' : 'font-semibold'}`}>{notification.title}</p><span className="rounded-full border border-workspace-border bg-workspace-elevated px-2 py-0.5 text-[9px] text-workspace-soft">{NOTIFICATION_LABELS[notification.type] ?? notification.type}</span>{unread && <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />}</div>{notification.body && <p className="mt-1.5 line-clamp-2 text-[11px] leading-5 text-workspace-muted">{notification.body}</p>}<p className="tnum mt-2 text-[9px] text-workspace-soft">{faDateTime(notification.createdAt)}</p></div></div>; return notification.linkType === 'CASE' && notification.linkId ? <Link key={notification.id} href={`/cases/${notification.linkId}`} onClick={() => void markRead(notification)}>{content}</Link> : <button key={notification.id} onClick={() => void markRead(notification)} className="block w-full text-right">{content}</button>; })}</div></Card>}
  </div>;
}
