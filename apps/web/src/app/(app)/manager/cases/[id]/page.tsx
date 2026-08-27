'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, downloadFile, getFileObjectUrl } from '@/lib/api';
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
  useConfirm,
  useToast,
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
  canTransfer: boolean;
  isManager: boolean;
  isCurrentOwner: boolean;
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
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<CaseDetail | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [workSessions, setWorkSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'' | 'transfer' | 'reject' | 'result'>('');
  const [busyAction, setBusyAction] = useState(false);
  const [preview, setPreview] = useState<{ url: string; type: string; name: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const detail = await api.get<CaseDetail>(`/cases/${id}`);
      setData(detail);
      const [acts, asgns, sessions] = await Promise.all([
        api.get<any[]>(`/cases/${id}/activities`),
        api.get<{ items: any[] }>(`/cases/${id}/assignments`),
        api.get<{ items: any[] }>(`/cases/${id}/work-sessions`).catch(() => ({ items: [] })),
      ]);
      setActivities(acts);
      setAssignments(asgns.items);
      setWorkSessions(sessions.items);
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
  // Managers oversee and reassign only; employees execute.
  const showEmployeeActions = !data.isManager && !isClosed;

  /** Runs an async action with busy state + toast feedback. */
  const runAction = async (fn: () => Promise<unknown>, successMsg: string) => {
    if (busyAction) return;
    setBusyAction(true);
    try {
      await fn();
      toast.success(successMsg);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطای غیرمنتظره');
    } finally {
      setBusyAction(false);
    }
  };

  const handleTransferClick = async () => {
    if (!data.currentOwner && data.status !== 'WAITING_ACCEPTANCE') return;
    const ok = await confirm({
      title: 'انتقال پرونده',
      message:
        data.isManager
          ? 'پرونده برای مسئول جدید ارجاع می‌شود و در تاریخچه ثبت خواهد شد.'
          : 'تا زمان پذیرش گیرنده، شما مسئولیت را از دست می‌دهید.',
      confirmLabel: 'ادامه',
    });
    if (ok) setModal('transfer');
  };

  const openAttachment = async (f: CaseDetail['files'][number]) => {
    setPreviewLoading(true);
    try {
      if (f.mimeType.startsWith('image/') || f.mimeType.startsWith('audio/') || f.mimeType === 'application/pdf') {
        const { url, type } = await getFileObjectUrl(`/files/${f.id}/download`);
        if (type === 'application/pdf') {
          // PDFs open best in a new tab via blob URL
          window.open(url, '_blank', 'noopener');
        } else {
          setPreview({ url, type, name: f.filename });
        }
      } else {
        await downloadFile(`/files/${f.id}/download`, f.filename);
        toast.success('فایل دانلود شد');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در باز کردن فایل');
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="space-y-5">
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

      {/* pending acceptance banner (employees who received the case) */}
      {!data.isManager && data.hasPendingAcceptanceForMe && data.status === 'WAITING_ACCEPTANCE' && (
        <PendingBanner caseId={id} runAction={runAction} busy={busyAction} onReject={() => setModal('reject')} />
      )}

      {/* action bar */}
      {(showEmployeeActions || (data.canTransfer && data.isManager)) && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-2.5">
            {showEmployeeActions && (
              <>
                {data.canEdit || data.isCurrentOwner ? (
                  <button onClick={() => setModal('result')} className={btnSecondary}>
                    📝 ثبت نتیجه / تکمیل
                  </button>
                ) : null}
              </>
            )}
            {data.canTransfer && (
              <button
                onClick={handleTransferClick}
                disabled={busyAction}
                className={`${btnSecondary} !border-brand-200 !text-brand-700 hover:!bg-brand-50`}
              >
                {busyAction ? '…' : '📤'} انتقال / ارجاع مجدد
              </button>
            )}
            {data.isManager && (
              <p className="mr-auto hidden text-xs text-slate-400 sm:block">
                حالت مدیریت: مشاهده کامل + ارجاع مجدد
              </p>
            )}
          </div>
        </Card>
      )}

      {/* ===== manager read-only case story ===== */}
      <CaseStory
        description={data.description}
        result={data.result}
        activities={activities}
        assignments={assignments}
        workSessions={workSessions}
      />

      {/* files (read-only for everyone; upload lives in employee flow) */}
      <Card className="p-5">
        <h2 className="mb-4 font-bold">فایل‌ها</h2>
        {data.files.length === 0 ? (
          <EmptyState title="فایلی پیوست نشده است" hint="فایل‌های پیوست کارکنان اینجا نمایش داده می‌شود." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.files.map((f) => (
              <li key={f.id} className="flex items-center gap-3 py-2.5">
                <span className="text-lg">{f.mimeType.startsWith('audio') ? '🎧' : f.mimeType.startsWith('image') ? '🖼️' : '📄'}</span>
                <button
                  onClick={() => openAttachment(f)}
                  className="min-w-0 flex-1 truncate text-right text-sm font-medium text-brand-700 hover:underline"
                >
                  {f.filename}
                  <span className="mr-2 text-xs font-normal text-slate-400">
                    ({f.uploader.firstName} {f.uploader.lastName})
                  </span>
                </button>
                <span className="tnum shrink-0 text-xs text-slate-400">{toFa((f.size / 1024).toFixed(0))} کیلوبایت</span>
                <span className="tnum hidden shrink-0 text-xs text-slate-400 sm:block">{faDateTime(f.createdAt)}</span>
                <button
                  onClick={() =>
                    downloadFile(`/files/${f.id}/download`, f.filename)
                      .then(() => toast.success('فایل دانلود شد'))
                      .catch((e) => toast.error(e instanceof Error ? e.message : 'خطا در دانلود'))
                  }
                  className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  دانلود
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {previewLoading && <Spinner label="در حال باز کردن فایل…" />}

      {preview && (
        <Modal open onClose={() => setPreview(null)} title={preview.name} wide>
          {preview.type.startsWith('image/') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.url} alt={preview.name} className="mx-auto max-h-[70vh] rounded-xl" />
          ) : (
            <audio controls src={preview.url} className="w-full" />
          )}
          <div className="mt-4 flex justify-end gap-2">
            <a href={preview.url} download={preview.name} className={`${btnSecondary} !py-1.5 !text-xs`}>
              ذخیره فایل
            </a>
          </div>
        </Modal>
      )}

      <RejectModal open={modal === 'reject'} onClose={() => setModal('')} caseId={id} onDone={load} />
      <ResultModal open={modal === 'result'} onClose={() => setModal('')} caseId={id} onDone={load} />
      <TransferModal open={modal === 'transfer'} onClose={() => setModal('')} caseId={id} onDone={load} />
    </div>
  );
}

function PendingBanner({
  caseId,
  runAction,
  busy,
  onReject,
}: {
  caseId: string;
  runAction: (fn: () => Promise<unknown>, m: string) => Promise<void>;
  busy: boolean;
  onReject: () => void;
}) {
  return (
    <Card className="border-amber-200 bg-amber-50/70 p-4 ring-amber-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-amber-800">این پرونده به شما ارجاع شده است. آن را می‌پذیرید؟</p>
        <div className="flex gap-2">
          <button
            onClick={() => runAction(() => api.post(`/cases/${caseId}/accept`), 'پرونده پذیرفته شد')}
            disabled={busy}
            className={`${btnPrimary.replace('w-full', '')} !bg-emerald-600 hover:!bg-emerald-700`}
          >
            ✓ پذیرش
          </button>
          <button onClick={onReject} className={`${btnSecondary} !border-red-200 !text-red-600 hover:!bg-red-50`}>
            ✕ رد کردن
          </button>
        </div>
      </div>
    </Card>
  );
}

/** Unified read-only story: description → timeline → transfers → work log. */
function CaseStory({
  description,
  result,
  activities,
  assignments,
  workSessions,
}: {
  description: string | null;
  result: string | null;
  activities: any[];
  assignments: any[];
  workSessions: any[];
}) {
  const totalSeconds = (workSessions ?? []).reduce(
    (sum: number, s: any) => sum + (s.durationSeconds ?? 0),
    0,
  );
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
        <h2 className="font-bold text-slate-800">📖 شرح کامل پرونده</h2>
        <p className="mt-0.5 text-xs text-slate-500">تمام رویدادها، یادداشت‌ها و گردش کار — فقط خواندنی</p>
      </div>

      <div className="space-y-5 p-5">
        {/* narrative summary strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StoryStat label="رویدادها" value={toFa(activities.length)} icon='🧾' />
          <StoryStat label="گردش ارجاع" value={toFa(assignments.length)} icon='📤' />
          <StoryStat label="نشست کاری" value={toFa((workSessions ?? []).length)} icon='⏱️' />
          <StoryStat label="زمان کل" value={faDuration(totalSeconds)} icon='⏳' />
        </div>

        {description && (
          <section>
            <h3 className="mb-2 text-sm font-bold text-slate-700">شرح اولیه</h3>
            <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3.5 text-sm leading-relaxed text-slate-600">
              {description}
            </p>
          </section>
        )}
        {result && (
          <section>
            <h3 className="mb-2 text-sm font-bold text-emerald-700">نتیجه نهایی</h3>
            <p className="whitespace-pre-wrap rounded-xl border border-emerald-100 bg-emerald-50/60 p-3.5 text-sm leading-relaxed text-emerald-900">
              {result}
            </p>
          </section>
        )}

        <section>
          <h3 className="mb-3 text-sm font-bold text-slate-700">خط زمان رویدادها</h3>
          <ActivityTimeline items={activities} />
        </section>

        <section>
          <h3 className="mb-3 text-sm font-bold text-slate-700">گردش ارجاع بین افراد</h3>
          <AssignmentHistory items={assignments} />
        </section>

        {(workSessions ?? []).length > 0 && (
          <section>
            <h3 className="mb-3 text-sm font-bold text-slate-700">گزارش کار واقعی</h3>
            <div className="space-y-2">
              {[...workSessions]
                .sort((a: any, b: any) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
                .map((s: any) => (
                  <div key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-2.5 text-xs">
                    <span className="font-semibold text-slate-700">
                      {s.user?.firstName} {s.user?.lastName}
                    </span>
                    <span className="tnum text-slate-500">{faDateTime(s.startedAt)}</span>
                    <span className="text-slate-300">→</span>
                    <span className="tnum text-slate-500">{s.endedAt ? faDateTime(s.endedAt) : 'در جریان'}</span>
                    <span className="tnum mr-auto rounded-full bg-violet-50 px-2 py-0.5 font-bold text-violet-700">
                      {faDuration(s.durationSeconds ?? 0)}
                    </span>
                  </div>
                ))}
            </div>
          </section>
        )}
      </div>
    </Card>
  );
}

function StoryStat({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white px-3 py-2.5">
      <p className="text-[11px] text-slate-400">
        {icon} {label}
      </p>
      <p className="tnum mt-0.5 text-sm font-extrabold text-slate-700">{value}</p>
    </div>
  );
}

function RejectModal({
  open,
  onClose,
  caseId,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  caseId: string;
  onDone: () => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title="رد کردن ارجاع">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api.post(`/cases/${caseId}/reject`, { reason });
            toast.success('پرونده رد و به ارجاع‌دهنده بازگشت');
            onClose();
            onDone();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'خطا');
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
}: {
  open: boolean;
  onClose: () => void;
  caseId: string;
  onDone: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [result, setResult] = useState('');
  const [complete, setComplete] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (complete) {
      const ok = await confirm({
        title: 'تکمیل پرونده',
        message: 'با تکمیل، پرونده بسته می‌شود و دیگر قابل تغییر نیست. مطمئن هستید؟',
        confirmLabel: 'بله، تکمیل کن',
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await api.post(`/cases/${caseId}/result`, { result, complete });
      toast.success(complete ? 'پرونده تکمیل شد' : 'نتیجه ثبت شد');
      setResult('');
      onClose();
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title="ثبت نتیجه">
      <form onSubmit={submit} className="space-y-4">
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
}: {
  open: boolean;
  onClose: () => void;
  caseId: string;
  onDone: () => void;
}) {
  const toast = useToast();
  const [members, setMembers] = useState<{ userId: string; fullName: string; role?: string }[]>([]);
  const [toUser, setToUser] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const meId = typeof window === 'undefined' ? '' : safeUserId();

  useEffect(() => {
    if (!open) return;
    api
      .get<{ items: { userId: string; fullName: string; isActive: boolean; role: string }[] }>('/members')
      .then((r) =>
        setMembers(r.items.filter((m) => m.isActive).map((m) => ({ userId: m.userId, fullName: m.fullName, role: m.role }))),
      )
      .catch(() => toast.error('دریافت فهرست همکاران ناموفق بود'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // managers cannot transfer to themselves or to other managers
  const eligible = members.filter(
    (m) => m.userId !== meId && m.role !== 'COMPANY_MANAGER',
  );

  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title="انتقال / ارجاع مجدد پرونده">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api.post(`/cases/${caseId}/transfer`, { toUserId: toUser, note: note || undefined });
            toast.success('پرونده ارجاع شد');
            setToUser('');
            setNote('');
            onClose();
            onDone();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'خطا');
          } finally {
            setBusy(false);
          }
        }}
        className="space-y-4"
      >
        <Field label="ارجاع به" required>
          <select className={inputClass} value={toUser} onChange={(e) => setToUser(e.target.value)} autoFocus>
            <option value="">— انتخاب همکار —</option>
            {eligible.map((m) => (
              <option key={m.userId} value={m.userId}>{m.fullName}</option>
            ))}
          </select>
        </Field>
        <Field label="یادداشت انتقال">
          <textarea className={`${inputClass} min-h-20`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="وضعیت فعلی، نکات مهم برای گیرنده…" />
        </Field>
        <p className="text-xs text-slate-400">
          تا زمانی که گیرنده پرونده را بپذیرد، وضعیت «در انتظار پذیرش» خواهد بود. این انتقال در تاریخچه ثبت می‌شود.
        </p>
        <button disabled={busy || !toUser} className={btnPrimary}>{busy ? 'در حال ارجاع…' : 'ارجاع پرونده'}</button>
      </form>
    </Modal>
  );
}

const TransferModal = TransferModalImpl;

function safeUserId(): string {
  try {
    return JSON.parse(localStorage.getItem('followa_user') ?? '{}').id ?? '';
  } catch {
    return '';
  }
}
