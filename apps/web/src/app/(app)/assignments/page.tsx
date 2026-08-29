'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { btnPrimary, btnSecondary, Card, EmptyState, ErrorState, Field, inputClass, Modal, PriorityBadge, Spinner, Toast } from '@/components/ui';
import { AssignmentsIcon, CheckIcon, CloseIcon } from '@/components/workspace/icons';
import { PageHeader } from '@/components/workspace/page';
import { faDate, faDateTime } from '@/lib/jalali';

interface PendingItem {
  assignmentId: string; createdAt: string; note: string | null;
  from?: { firstName: string; lastName: string } | null;
  case: { id: string; number: number; title: string; description: string | null; priority: string; dueDate: string | null; createdBy: { firstName: string; lastName: string }; caseType?: { name: string } | null; };
}

export default function AssignmentsPage() {
  const [items, setItems] = useState<PendingItem[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [rejecting, setRejecting] = useState<PendingItem | null>(null); const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const showToast = (message: string, tone: 'success' | 'error') => { setToast({ message, tone }); setTimeout(() => setToast(null), 3500); };
  const load = useCallback(async () => { try { setError(''); const res = await api.get<{ items: PendingItem[] }>('/assignments/pending'); setItems(res.items); } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const accept = async (caseId: string) => { try { await api.post(`/cases/${caseId}/accept`); showToast('پرونده پذیرفته شد', 'success'); void load(); } catch (err) { showToast(err instanceof Error ? err.message : 'خطا', 'error'); } };
  if (loading) return <Spinner />; if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.message} tone={toast.tone} />}
      <PageHeader eyebrow="صندوق ورودی کار" title="ارجاع‌های جدید" description="پرونده‌هایی که برای شروع مسئولیت منتظر پذیرش یا رد شما هستند." icon={<AssignmentsIcon className="h-5 w-5" />} meta={`${items.length.toLocaleString('fa-IR')} ارجاع در انتظار`} />
      {items.length === 0 ? <Card><EmptyState title="ارجاع در انتظاری ندارید" hint="وقتی پرونده‌ای به شما ارجاع شود، برای تصمیم‌گیری در همین صفحه نمایش داده می‌شود." /></Card> : (
        <div className="grid gap-3 xl:grid-cols-2">
          {items.map((item) => (
            <Card key={item.assignmentId} className="relative overflow-hidden p-5">
              <span className="absolute inset-y-4 right-0 w-0.5 rounded-full bg-amber-400" />
              <div className="flex flex-wrap items-center gap-2"><span className="tnum rounded-lg border border-workspace-border bg-workspace-elevated px-2 py-1 text-[10px] font-black text-workspace-muted">#{item.case.number.toLocaleString('fa-IR')}</span><PriorityBadge priority={item.case.priority} />{item.case.caseType && <span className="rounded-full border border-workspace-border px-2.5 py-1 text-[10px] text-workspace-soft">{item.case.caseType.name}</span>}</div>
              <Link href={`/cases/${item.case.id}`} className="mt-3 block text-sm font-black text-workspace-ink transition hover:text-brand-200">{item.case.title}</Link>
              {item.case.description && <p className="mt-2 line-clamp-2 text-xs leading-6 text-workspace-muted">{item.case.description}</p>}
              {item.note && <div className="mt-3 rounded-xl border border-brand-400/15 bg-brand-400/5 px-3.5 py-3 text-[11px] leading-6 text-brand-100"><span className="font-bold">پیام ارجاع‌دهنده:</span> {item.note}</div>}
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-workspace-border pt-3 text-[10px] text-workspace-soft"><span>از {item.from ? `${item.from.firstName} ${item.from.lastName}` : `${item.case.createdBy.firstName} ${item.case.createdBy.lastName}`}</span><span>{faDateTime(item.createdAt)}</span>{item.case.dueDate && <span>سررسید {faDate(item.case.dueDate)}</span>}</div>
              <div className="mt-4 flex flex-wrap gap-2.5"><button onClick={() => accept(item.case.id)} className={`${btnPrimary.replace('w-full', '')} !bg-emerald-600 hover:!bg-emerald-500`}><CheckIcon className="h-4 w-4" />پذیرش کار</button><button onClick={() => setRejecting(item)} className={`${btnSecondary} !border-red-400/20 !text-red-300 hover:!bg-red-400/10`}><CloseIcon className="h-4 w-4" />رد کردن</button></div>
            </Card>
          ))}
        </div>
      )}
      <RejectModal item={rejecting} onClose={() => setRejecting(null)} onDone={load} showToast={showToast} />
    </div>
  );
}

function RejectModal({ item, onClose, onDone, showToast }: { item: PendingItem | null; onClose: () => void; onDone: () => void; showToast: (m: string, t: 'success' | 'error') => void; }) {
  const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false);
  return <Modal open={Boolean(item)} onClose={onClose} title="رد کردن ارجاع">{item && <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await api.post(`/cases/${item.case.id}/reject`, { reason }); showToast('پرونده رد شد', 'success'); setReason(''); onClose(); onDone(); } catch (err) { showToast(err instanceof Error ? err.message : 'خطا', 'error'); } finally { setBusy(false); } }} className="space-y-4"><p className="text-xs leading-6 text-workspace-muted">«{item.case.title}» پس از رد شدن به ارجاع‌دهنده بازمی‌گردد.</p><Field label="دلیل رد کردن" required><textarea className={`${inputClass} min-h-24`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="چرا نمی‌توانید این کار را انجام دهید؟" autoFocus /></Field><button disabled={busy || reason.length < 3} className={btnPrimary}>ثبت رد</button></form>}</Modal>;
}
