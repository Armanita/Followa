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
  Toast,
} from '@/components/ui';
import { ActivityTimeline, AssignmentHistory } from '@/components/timeline';
import { faDate, faDateInput, faDateTime, jalaliDateTimeToIso, toFa } from '@/lib/jalali';

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
  currentOwner?: { id: string; firstName: string; lastName: string } | null;
  createdBy: { id: string; firstName: string; lastName: string };
  caseType?: { id: string; name: string; color: string | null } | null;
  files: {
    id: string;
    filename: string;
    size: number;
    mimeType: string;
    createdAt: string;
    uploader: { firstName: string; lastName: string };
  }[];
}

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<CaseDetail | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [modal, setModal] = useState<'' | 'result' | 'transfer' | 'reject'>('');
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
      const [acts, asgns] = await Promise.all([
        api.get<any[]>(`/cases/${id}/activities`),
        api.get<{ items: any[] }>(`/cases/${id}/assignments`),
      ]);
      setActivities(acts);
      setAssignments(asgns.items);
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

  const viewFile = async (file: CaseDetail['files'][number]) => {
    try {
      const { url } = await getFileObjectUrl(`/files/${file.id}/download`);
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'خطا در مشاهده فایل', 'error');
    }
  };

  const handleDownload = async (file: CaseDetail['files'][number]) => {
    try {
      await downloadFile(`/files/${file.id}/download`, file.filename);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'خطا در دانلود فایل', 'error');
    }
  };

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.message} tone={toast.tone} />}

      <button onClick={() => router.back()} className="text-sm font-medium text-slate-500 hover:text-slate-700">
        → بازگشت
      </button>

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
            <span
              className={`tnum rounded-full px-2.5 py-0.5 text-xs font-medium ${
                new Date(data.dueDate) < new Date() && !isClosed
                  ? 'bg-red-50 text-red-600'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              سررسید: {faDate(data.dueDate)}
            </span>
          )}
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
              <p className="text-slate-400">آخرین ثبت نتیجه</p>
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
            <p className="mb-1 text-xs font-bold text-emerald-700">آخرین نتیجه ثبت‌شده</p>
            <p className="whitespace-pre-wrap text-sm text-emerald-900">{data.result}</p>
          </div>
        )}
      </Card>

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
              <button
                onClick={() => setModal('reject')}
                className={`${btnSecondary} !border-red-200 !text-red-600 hover:!bg-red-50`}
              >
                ✕ رد کردن
              </button>
            </div>
          </div>
        </Card>
      )}

      {!isClosed && data.canEdit && (
        <Card className="p-4">
          <div className="flex flex-wrap gap-2.5">
            <button onClick={() => setModal('result')} className={btnSecondary}>
              📝 ثبت نتیجه / ادامه پیگیری
            </button>
            <button onClick={() => setModal('transfer')} className={btnSecondary}>
              📤 انتقال به همکار
            </button>
            <input
              ref={fileInput}
              type="file"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const formData = new FormData();
                formData.append('file', file);
                void action(() => api.post(`/cases/${id}/files`, formData), 'فایل پیوست شد');
                e.target.value = '';
              }}
            />
            <button onClick={() => fileInput.current?.click()} className={btnSecondary}>
              📎 پیوست فایل
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            زمان صرف‌شده و پیگیری بعدی هنگام «ثبت نتیجه» ثبت می‌شوند؛ تایمر شروع/پایان کار حذف شده است.
          </p>
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

      <Card className="p-5">
        <h2 className="mb-4 font-bold">فایل‌ها</h2>
        {data.files.length === 0 ? (
          <EmptyState title="فایلی پیوست نشده است" hint="با دکمه «پیوست فایل» سند، عکس یا صوت اضافه کنید." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.files.map((file) => (
              <li key={file.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="text-lg">
                  {file.mimeType.startsWith('audio') ? '🎧' : file.mimeType.startsWith('image') ? '🖼️' : '📄'}
                </span>
                <button
                  type="button"
                  onClick={() => void viewFile(file)}
                  className="min-w-0 flex-1 truncate text-right text-sm font-medium text-brand-700 hover:underline"
                >
                  {file.filename}
                </button>
                <span className="tnum shrink-0 text-xs text-slate-400">
                  {toFa((file.size / 1024).toFixed(0))} کیلوبایت
                </span>
                <span className="tnum hidden shrink-0 text-xs text-slate-400 sm:block">
                  {faDateTime(file.createdAt)}
                </span>
                <div className="flex shrink-0 gap-1.5">
                  <button type="button" onClick={() => void viewFile(file)} className={btnSecondary}>
                    مشاهده
                  </button>
                  <button type="button" onClick={() => void handleDownload(file)} className={btnSecondary}>
                    دانلود
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <RejectModal
        open={modal === 'reject'}
        onClose={() => setModal('')}
        caseId={id}
        onDone={load}
        showToast={showToast}
      />
      <ResultModal
        open={modal === 'result'}
        onClose={() => setModal('')}
        caseId={id}
        onDone={load}
        showToast={showToast}
      />
      <TransferModal
        open={modal === 'transfer'}
        onClose={() => setModal('')}
        caseId={id}
        onDone={load}
        showToast={showToast}
      />
    </div>
  );
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
        <button disabled={busy || reason.length < 3} className={btnPrimary}>
          ثبت رد
        </button>
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
  const [effortMinutes, setEffortMinutes] = useState('');
  const [complete, setComplete] = useState(false);
  const [createNextReminder, setCreateNextReminder] = useState(false);
  const [reminderDate, setReminderDate] = useState(() => faDateInput(new Date(Date.now() + 86400_000)));
  const [reminderTime, setReminderTime] = useState('09:00');
  const [reminderNote, setReminderNote] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <Modal open={open} onClose={onClose} title="ثبت نتیجه پیگیری">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const effort = Number(effortMinutes);
          if (!Number.isInteger(effort) || effort < 1 || effort > 1440) {
            showToast('زمان صرف‌شده را بین ۱ تا ۱۴۴۰ دقیقه وارد کنید', 'error');
            return;
          }

          setBusy(true);
          try {
            let nextReminder: { remindAt: string; note?: string } | undefined;
            if (!complete && createNextReminder) {
              const remindAt = jalaliDateTimeToIso(reminderDate, reminderTime);
              if (new Date(remindAt).getTime() < Date.now() - 60_000) {
                throw new Error('زمان یادآوری نمی‌تواند در گذشته باشد');
              }
              nextReminder = {
                remindAt,
                ...(reminderNote.trim() ? { note: reminderNote.trim() } : {}),
              };
            }

            await api.post(`/cases/${caseId}/result`, {
              result,
              complete,
              effortMinutes: effort,
              ...(nextReminder ? { nextReminder } : {}),
            });
            showToast(
              complete
                ? 'نتیجه ثبت و پرونده تکمیل شد'
                : nextReminder
                  ? 'نتیجه و یادآوری بعدی ثبت شد'
                  : 'نتیجه ثبت شد',
              'success',
            );
            setResult('');
            setEffortMinutes('');
            setComplete(false);
            setCreateNextReminder(false);
            setReminderNote('');
            setReminderDate(faDateInput(new Date(Date.now() + 86400_000)));
            setReminderTime('09:00');
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
            placeholder="چه کاری انجام شد و نتیجه چه بود؟"
            autoFocus
          />
        </Field>

        <Field label="زمان صرف‌شده (دقیقه)" required>
          <input
            type="number"
            min={1}
            max={1440}
            inputMode="numeric"
            dir="ltr"
            className={inputClass}
            value={effortMinutes}
            onChange={(e) => setEffortMinutes(e.target.value)}
            placeholder="مثلاً ۲۰"
          />
        </Field>
        <p className="text-xs text-slate-400">
          این مقدار تخمین خود کارمند از زمان صرف‌شده برای همین مرحله است و جایگزین تایمر شروع/پایان شده است.
        </p>

        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={complete}
            onChange={(e) => {
              setComplete(e.target.checked);
              if (e.target.checked) setCreateNextReminder(false);
            }}
            className="accent-brand-600"
          />
          موضوع کاملاً بسته شده — پرونده تکمیل شود
        </label>

        {!complete && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={createNextReminder}
                onChange={(e) => setCreateNextReminder(e.target.checked)}
                className="accent-brand-600"
              />
              برای پیگیری بعدی یادآوری ثبت شود
            </label>

            {createNextReminder && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="تاریخ شمسی" required>
                    <input
                      type="text"
                      inputMode="numeric"
                      dir="ltr"
                      className={inputClass}
                      value={reminderDate}
                      onChange={(e) => setReminderDate(e.target.value)}
                      placeholder="۱۴۰۵/۰۶/۰۷"
                    />
                  </Field>
                  <Field label="ساعت" required>
                    <input
                      type="time"
                      dir="ltr"
                      className={inputClass}
                      value={reminderTime}
                      onChange={(e) => setReminderTime(e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="یادداشت پیگیری بعدی">
                  <input
                    className={inputClass}
                    value={reminderNote}
                    onChange={(e) => setReminderNote(e.target.value)}
                    placeholder="مثلاً: تماس برای تأیید قرارداد"
                  />
                </Field>
                <p className="text-xs text-slate-400">
                  تاریخ به‌صورت شمسی وارد می‌شود؛ تبدیل زمان برای ذخیره‌سازی در سرور انجام می‌شود.
                </p>
              </div>
            )}
          </div>
        )}

        <button disabled={busy || result.trim().length < 2 || !effortMinutes} className={btnPrimary}>
          {busy ? 'در حال ثبت…' : complete ? 'ثبت نتیجه و تکمیل پرونده' : 'ثبت نتیجه'}
        </button>
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
      .then((response) => setMembers(response.items.filter((member) => member.isActive)))
      .catch(() =>
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
          <select
            className={inputClass}
            value={toUser}
            onChange={(e) => setToUser(e.target.value)}
            autoFocus
          >
            <option value="">— انتخاب همکار —</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.fullName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="توضیح">
          <textarea
            className={`${inputClass} min-h-20`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="وضعیت فعلی و ادامه کار…"
          />
        </Field>
        <p className="text-xs text-slate-400">
          تا زمانی که گیرنده پرونده را بپذیرد، وضعیت «در انتظار پذیرش» خواهد بود.
        </p>
        <button disabled={busy || !toUser} className={btnPrimary}>
          انتقال
        </button>
      </form>
    </Modal>
  );
}

const TransferModal = TransferModalImpl;
