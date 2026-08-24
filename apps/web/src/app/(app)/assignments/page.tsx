'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  btnPrimary,
  btnSecondary,
  Card,
  EmptyState,
  ErrorState,
  Field,
  inputClass,
  Modal,
  PriorityBadge,
  Spinner,
  Toast,
} from '@/components/ui';
import { faDate, faDateTime } from '@/lib/jalali';

interface PendingItem {
  assignmentId: string;
  createdAt: string;
  note: string | null;
  from?: { firstName: string; lastName: string } | null;
  case: {
    id: string;
    number: number;
    title: string;
    description: string | null;
    priority: string;
    dueDate: string | null;
    createdBy: { firstName: string; lastName: string };
    caseType?: { name: string } | null;
  };
}

export default function AssignmentsPage() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState<PendingItem | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const showToast = (message: string, tone: 'success' | 'error') => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    try {
      setError('');
      const res = await api.get<{ items: PendingItem[] }>('/assignments/pending');
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

  const accept = async (caseId: string) => {
    try {
      await api.post(`/cases/${caseId}/accept`);
      showToast('پرونده پذیرفته شد', 'success');
      void load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'خطا', 'error');
    }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.message} tone={toast.tone} />}
      <div>
        <h1 className="text-xl font-extrabold">ارجاع‌های جدید</h1>
        <p className="mt-0.5 text-sm text-slate-500">پرونده‌هایی که منتظر پاسخ شما هستند</p>
      </div>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            title="ارجاع در انتظاری ندارید"
            hint="وقتی پرونده‌ای به شما ارجاع شود اینجا نمایش داده می‌شود."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.assignmentId} className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="tnum rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
                  #{item.case.number.toLocaleString('fa-IR')}
                </span>
                <PriorityBadge priority={item.case.priority} />
                <Link href={`/cases/${item.case.id}`} className="min-w-0 flex-1 truncate font-semibold hover:text-brand-700">
                  {item.case.title}
                </Link>
              </div>
              {item.case.description && (
                <p className="mt-2 line-clamp-2 text-sm text-slate-500">{item.case.description}</p>
              )}
              {item.note && (
                <p className="mt-2 rounded-xl bg-brand-50 px-3.5 py-2.5 text-sm text-brand-800">
                  پیام ارجاع‌دهنده: {item.note}
                </p>
              )}
              <p className="tnum mt-3 text-xs text-slate-400">
                از {item.from ? `${item.from.firstName} ${item.from.lastName}` : item.case.createdBy.firstName + ' ' + item.case.createdBy.lastName}
                {' · '}
                {faDateTime(item.createdAt)}
                {item.case.dueDate && ` · سررسید ${faDate(item.case.dueDate)}`}
                {item.case.caseType && ` · ${item.case.caseType.name}`}
              </p>
              <div className="mt-4 flex gap-2.5">
                <button onClick={() => accept(item.case.id)} className={`${btnPrimary.replace('w-full', '')} !bg-emerald-600 hover:!bg-emerald-700`}>
                  ✓ پذیرش کار
                </button>
                <button onClick={() => setRejecting(item)} className={`${btnSecondary} !border-red-200 !text-red-600 hover:!bg-red-50`}>
                  ✕ رد کردن (با دلیل)
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <RejectModal item={rejecting} onClose={() => setRejecting(null)} onDone={load} showToast={showToast} />
    </div>
  );
}

function RejectModal({
  item,
  onClose,
  onDone,
  showToast,
}: {
  item: PendingItem | null;
  onClose: () => void;
  onDone: () => void;
  showToast: (m: string, t: 'success' | 'error') => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={Boolean(item)} onClose={onClose} title="رد کردن ارجاع">
      {item && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api.post(`/cases/${item.case.id}/reject`, { reason });
              showToast('پرونده رد شد', 'success');
              setReason('');
              onClose();
              onDone();
            } catch (err) {
              showToast(err instanceof Error ? err.message : 'خطا', 'error');
            } finally {
              setBusy(false);
            }
          }}
          className="space-y-4"
        >
          <p className="text-sm text-slate-500">
            «{item.case.title}» پس از رد شدن به ارجاع‌دهنده بازمی‌گردد.
          </p>
          <Field label="دلیل رد کردن" required>
            <textarea
              className={`${inputClass} min-h-24`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="چرا نمی‌توانید این کار را انجام دهید؟"
              autoFocus
            />
          </Field>
          <button disabled={busy || reason.length < 3} className={btnPrimary}>ثبت رد</button>
        </form>
      )}
    </Modal>
  );
}
