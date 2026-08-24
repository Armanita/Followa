'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  StatusBadge,
  Toast,
} from '@/components/ui';
import { ActivityTimeline, AssignmentHistory } from '@/components/timeline';
import { faDate, faDateTime, faDuration, toFa } from '@/lib/jalali';

interface CaseDetail {
  id: string;
  number: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  result: string | null;
  resultAt: string | null;
  createdAt: string;
  canEdit: boolean;
  hasPendingAcceptanceForMe: boolean;
  totalWorkSeconds: number;
  currentOwner?: { id: string; firstName: string; lastName: string } | null;
  createdBy: { id: string; firstName: string; lastName: string };
  caseType?: { id: string; name: string; color: string | null } | null;
  files: { id: string; filename: string; size: number; mimeType: string; createdAt: string; uploader: { firstName: string; lastName: string } }[];
}

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<CaseDetail | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [myActiveSession, setMyActiveSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [modal, setModal] = useState<'' | 'result' | 'transfer' | 'reminder' | 'reject'>('');
  const fileInput = useRef<HTMLInputElement>(null);

  const showToast = (message: string, tone: 'success' | 'error') => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    try {
      setError('');
      const detail = await api.get<CaseDetail>(`/cases/${id}`);
      setData(detail);
      const [acts, asgns, active] = await Promise.all([
        api.get<any[]>(`/cases/${id}/activities`),
        api.get<{ items: any[] }>(`/cases/${id}/assignments`),
        api.get<{ items: any[] }>('/work-sessions/active').catch(() => ({ items: [] })),
      ]);
      setActivities(acts);
      setAssignments(asgns.items);
      setMyActiveSession(active.items.find((s) => s.caseId === id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Spinner />;
  if (error)
    return (
      <div className="space-y-4">
        <ErrorState message={error} onRetry={load} />
        <div className="text-center">
          <Link href="/cases" className="text-sm font-medium text-brand-600 hover:underline">
            ← بازگشت به پرونده‌ها
          </Link>
        </div>
      </div>
    );
  if (!data) return null;

  const isClosed = data.status === 'DONE' || data.status === 'CANCELLED';

  const action = async (fn: () => Promise<unknown>, successMsg: string) => {
    try {
      await fn();
      showToast(successMsg, 'success');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'خطا', 'error');
    }
  };

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.message} tone={toast.tone} />}

      <button onClick={() => router.back()} className="text-sm font-medium text-slate-500 hover:text-slate-700">
        → بازگشت
      </button>

      {/* header card */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-3">
          <span className="tnum rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">
            #{toFa(data.number)}
          </span>
          <h1 className="min-w-0 flex-1 text-xl font-extrabold leading-snug">{data.title}</h1>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={data.status} />
          <PriorityBadge priority={data.priority} />
          {data.caseType && (
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset"
              style={{
                color: data.caseType.color ?? '#334155',
                backgroundColor: `${data.caseType.color ?? '#64748b'}14`,
                borderColor: data.caseType.color ?? undefined,
                ['--tw-ring-color' as string]: `${data.caseType.color ?? '#64748b'}40`,
              }}
            >
              {data.caseType.name}
            </span>
          )}
          {data.dueDate && (
            <span className={`tnum rounded-full px-2.5 py-0.5 text-xs font-medium ${new Date(data.dueDate) < new Date() && !isClosed ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
              سررسید: {faDate(data.dueDate)}
            </span>
          )}
          <span className="tnum rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
            زمان کار: {faDuration(data.totalWorkSeconds)}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500 sm:grid-cols-4">
          <div>
            <p className="text-slate-400">مسئول فعلی</p>
            <p className="mt-0.5 font-semibold text-slate-700">
              {data.currentOwner ? `${data.currentOwner.firstName} ${data.currentOwner.lastName}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-slate-400">سازنده</p>
            <p className="mt-0.5 font-semibold text-slate-700">
              {data.createdBy.firstName} {data.createdBy.lastName}
            </p>
          </div>
          <div>
            <p className="text-slate-400">تاریخ ایجاد</p>
            <p className="tnum mt-0.5 font-semibold text-slate-700">{faDateTime(data.createdAt)}</p>
          </div>
          {data.resultAt && (
            <div>
              <p className="text-slate-400">زمان نتیجه</p>
              <p className="tnum mt-0.5 font-semibold text-slate-700">{faDateTime(data.resultAt)}</p>
            </div>
          )}
        </div>
        {data.description && (
          <p className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-3.5 text-sm leading-relaxed text-slate-600">
            {data.description}
          </p>
        )}
        {data.result && (
          <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3.5">
            <p className="mb-1 text-xs font-bold text-emerald-700">نتیجه ثبت‌شده</p>
            <p className="whitespace-pre-wrap text-sm text-emerald-900">{data.result}</p>
          </div>
        )}
      </Card>

      {/* pending acceptance banner */}
      {data.hasPendingAcceptanceForMe && data.status === 'WAITING_ACCEPTANCE' && (
        <Card className="border-amber-200 bg-amber-50/70 p-4 ring-amber-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-amber-800">
              این پرونده به شما ارجاع شده است. آن را می‌پذیرید؟
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => action(() => api.post(`/cases/${id}/accept`), 'پرونده پذیرفته شد')}
                className={`${btnPrimary.replace('w-full', '')} !bg-emerald-600 hover:!bg-emerald-700`}
              >
                ✓ پذیرش
              </button>
              <button onClick={() => setModal('reject')} className={`${btnSecondary} !border-red-200 !text-red-600 hover:!bg-red-50`}>
                ✕ رد کردن
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* action bar */}
      {!isClosed && (
        <Card className="p-4">
          <div className="flex flex-wrap gap-2.5">
            {myActiveSession ? (
              <button
                onClick={() => action(() => api.post('/work-sessions/end', { caseId: id }), 'پایان کار ثبت شد')}
                className={`${btnSecondary} !border-red-200 !text-red-600`}
              >
                ⏹ پایان کار
              </button>
            ) : (
              data.currentOwner?.id === myUserId() && (
                <button
                  onClick={() => action(() => api.post('/work-sessions/start', { caseId: id }), 'کار شروع شد')}
                  className={`${btnSecondary} !border-emerald-200 !text-emerald-700`}
                >
                  ▶ شروع کار
                </button>
              )
            )}
            {(data.canEdit || data.currentOwner?.id === myUserId()) && (
              <>
                <button onClick={() => setModal('result')} className={btnSecondary}>
                  📝 ثبت نتیجه / تکمیل
                </button>
                <button onClick={() => setModal('transfer')} className={btnSecondary}>
                  📤 انتقال به همکار
                </button>
                <button onClick={() => setModal('reminder')} className={btnSecondary}>
                  ⏰ یادآوری
                </button>
              </>
            )}
            <input
              ref={fileInput}
              type="file"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const fd = new FormData();
                fd.append('file', f);
                action(
                  () => fetch(`/api/v1/cases/${id}/files`, {
                    method: 'POST',
                    headers: { authorization: `Bearer ${localStorage.getItem('followa_token')}` },
                    body: fd,
                  }).then(async (r) => {
                    if (!r.ok) {
                      const j = await r.json().catch(() => null);
                      throw new Error(j?.message ?? 'خطا در آپلود');
                    }
                  }),
                  'فایل پیوست شد',
                );
                e.target.value = '';
              }}
            />
            <button onClick={() => fileInput.current?.click()} className={btnSecondary}>
              📎 پیوست فایل
            </button>
          </div>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 font-bold">گردش ارجاع</h2>
          <AssignmentHistory items={assignments} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 font-bold">خط زمان فعالیت‌ها</h2>
          <ActivityTimeline items={activities} />
        </Card>
      </div>

      {/* files */}
      <Card className="p-5">
        <h2 className="mb-4 font-bold">فایل‌ها</h2>
        {data.files.length === 0 ? (
          <EmptyState title="فایلی پیوست نشده است" hint="با دکمه «پیوست فایل» سند، عکس یا صوت اضافه کنید." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.files.map((f) => (
              <li key={f.id} className="flex items-center gap-3 py-2.5">
                <span className="text-lg">{f.mimeType.startsWith('audio') ? '🎧' : f.mimeType.startsWith('image') ? '🖼️' : '📄'}</span>
                <a
                  href={`/api/v1/files/${f.id}/download`}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate text-sm font-medium text-brand-700 hover:underline"
                >
                  {f.filename}
                </a>
                <span className="tnum shrink-0 text-xs text-slate-400">{toFa((f.size / 1024).toFixed(0))} کیلوبایت</span>
                <span className="tnum hidden shrink-0 text-xs text-slate-400 sm:block">{faDateTime(f.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <RejectModal open={modal === 'reject'} onClose={() => setModal('')} caseId={id} onDone={load} showToast={showToast} />
      <ResultModal open={modal === 'result'} onClose={() => setModal('')} caseId={id} onDone={load} showToast={showToast} />
      <TransferModal open={modal === 'transfer'} onClose={() => setModal('')} caseId={id} onDone={load} showToast={showToast} />
      <ReminderModal open={modal === 'reminder'} onClose={() => setModal('')} caseId={id} onDone={load} showToast={showToast} />
    </div>
  );
}

function myUserId(): string {
  if (typeof window === 'undefined') return '';
  try {
    return JSON.parse(localStorage.getItem('followa_user') ?? '{}').id ?? '';
  } catch {
    return '';
  }
}

function RejectModal({
  open,
  onClose,
  caseId,
  onDone,
  showToast,
}: {
  open: boolean;
  onClose: () => void;
  caseId: string;
  onDone: () => void;
  showToast: (m: string, t: 'success' | 'error') => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title="رد کردن ارجاع">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api.post(`/cases/${caseId}/reject`, { reason });
            showToast('پرونده رد و به ارجاع‌دهنده بازگشت', 'success');
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
        <Field label="دلیل رد کردن" required>
          <textarea
            className={`${inputClass} min-h-24`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="چرا نمی‌توانید این کار را انجام دهید؟"
            autoFocus
          />
        </Field>
        <p className="text-xs text-slate-400">پرونده پس از رد شدن به ارجاع‌دهنده بازمی‌گردد.</p>
        <button disabled={busy || reason.length < 3} className={btnPrimary}>ثبت رد</button>
      </form>
    </Modal>
  );
}

function ResultModal({
  open,
  onClose,
  caseId,
  onDone,
  showToast,
}: {
  open: boolean;
  onClose: () => void;
  caseId: string;
  onDone: () => void;
  showToast: (m: string, t: 'success' | 'error') => void;
}) {
  const [result, setResult] = useState('');
  const [complete, setComplete] = useState(true);
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title="ثبت نتیجه">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api.post(`/cases/${caseId}/result`, { result, complete });
            showToast(complete ? 'پرونده تکمیل شد' : 'نتیجه ثبت شد', 'success');
            setResult('');
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
        <Field label="نتیجه پیگیری" required>
          <textarea
            className={`${inputClass} min-h-32`}
            value={result}
            onChange={(e) => setResult(e.target.value)}
            placeholder="چه اتفاقی افتاد؟ نتیجه مذاکره، قرار بعدی…"
            autoFocus
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={complete} onChange={(e) => setComplete(e.target.checked)} className="accent-brand-600" />
          موضوع کاملاً بسته شده — پرونده تکمیل شود
        </label>
        <button disabled={busy || result.length < 2} className={btnPrimary}>ثبت</button>
      </form>
    </Modal>
  );
}

function TransferModalImpl({
  open,
  onClose,
  caseId,
  onDone,
  showToast,
}: {
  open: boolean;
  onClose: () => void;
  caseId: string;
  onDone: () => void;
  showToast: (m: string, t: 'success' | 'error') => void;
}) {
  const [members, setMembers] = useState<{ userId: string; fullName: string }[]>([]);
  const [toUser, setToUser] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    api
      .get<{ items: { userId: string; fullName: string; isActive: boolean }[] }>('/members')
      .then((r) => setMembers(r.items.filter((m) => m.isActive)))
      .catch(() =>
        // fallback for employees: derive colleagues from company members via profile company
        api.get<{ company: { name: string } | null }>('/profile').then(async () => {
          showToast('برای انتخاب مقصد با مدیر هماهنگ کنید یا از لیست داشبورد استفاده کنید', 'error');
        }),
      );
  }, [open, showToast]);

  return (
    <Modal open={open} onClose={onClose} title="انتقال پرونده">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api.post(`/cases/${caseId}/transfer`, { toUserId: toUser, note: note || undefined });
            showToast('پرونده ارجاع شد', 'success');
            setToUser('');
            setNote('');
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
        <Field label="ارجاع به" required>
          <select className={inputClass} value={toUser} onChange={(e) => setToUser(e.target.value)} autoFocus>
            <option value="">— انتخاب همکار —</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>{m.fullName}</option>
            ))}
          </select>
        </Field>
        <Field label="توضیح">
          <textarea className={`${inputClass} min-h-20`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="وضعیت فعلی و ادامه کار…" />
        </Field>
        <p className="text-xs text-slate-400">
          تا زمانی که گیرنده پرونده را بپذیرد، وضعیت «در انتظار پذیرش» خواهد بود.
        </p>
        <button disabled={busy || !toUser} className={btnPrimary}>انتقال</button>
      </form>
    </Modal>
  );
}

const TransferModal = TransferModalImpl;

function ReminderModal({
  open,
  onClose,
  caseId,
  onDone,
  showToast,
}: {
  open: boolean;
  onClose: () => void;
  caseId: string;
  onDone: () => void;
  showToast: (m: string, t: 'success' | 'error') => void;
}) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const tomorrow = new Date(Date.now() + 86400_000);
  useEffect(() => {
    if (open && !date) {
      setDate(tomorrow.toISOString().slice(0, 10));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="ساخت یادآوری">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api.post('/reminders', {
              caseId,
              remindAt: new Date(`${date}T${time}:00`).toISOString(),
              note: note || undefined,
            });
            showToast('یادآوری ساخته شد', 'success');
            setNote('');
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="تاریخ" required>
            <input type="date" dir="ltr" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="ساعت" required>
            <input type="time" dir="ltr" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <Field label="یادداشت">
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً: تماس دوم با مشتری" />
        </Field>
        <p className="text-xs text-slate-400">در زمان مقرر در بخش یادآوری‌ها و اعلان‌ها نمایش داده می‌شود.</p>
        <button disabled={busy} className={btnPrimary}>ساخت یادآوری</button>
      </form>
    </Modal>
  );
}
