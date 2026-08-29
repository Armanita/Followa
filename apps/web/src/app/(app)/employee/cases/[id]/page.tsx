'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
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
import {
  ActivityTimeline,
  AssignmentHistory,
  type AssignmentRow,
  type TimelineEntry,
} from '@/components/timeline';
import { CaseTransferModal } from '@/components/workspace/case-transfer-modal';
import {
  ActivityIcon,
  ArrowLeftIcon,
  CalendarIcon,
  CasesIcon,
  CheckIcon,
  DownloadIcon,
  EmployeesIcon,
  FileIcon,
  ResultIcon,
  TransferIcon,
  UploadIcon,
} from '@/components/workspace/icons';
import { PageHeader, PanelHeader } from '@/components/workspace/page';
import { faDate, faDateInput, faDateTime, isLate, jalaliDateTimeToIso, toFa } from '@/lib/jalali';

interface CaseFile {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  createdAt: string;
  uploader: { id?: string; firstName: string; lastName: string };
}

interface CaseReminder {
  id: string;
  remindAt: string;
  note: string | null;
  status: string;
  assignee?: { id: string; firstName: string; lastName: string } | null;
}

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
  isCurrentOwner: boolean;
  hasPendingAcceptanceForMe: boolean;
  currentOwner?: { id: string; firstName: string; lastName: string } | null;
  createdBy: { id: string; firstName: string; lastName: string };
  caseType?: { id: string; name: string; color: string | null } | null;
  customer?: { id: string; type: 'INDIVIDUAL' | 'LEGAL'; name: string; isActive: boolean } | null;
  reminders?: CaseReminder[];
  files: CaseFile[];
}

export default function EmployeeCaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [data, setData] = useState<CaseDetail | null>(null);
  const [activities, setActivities] = useState<TimelineEntry[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'' | 'result' | 'transfer' | 'reject'>('');
  const [busyAction, setBusyAction] = useState(false);
  const [preview, setPreview] = useState<{ url: string; type: string; name: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [detail, acts, asgns] = await Promise.all([
        api.get<CaseDetail>(`/cases/${id}`),
        api.get<TimelineEntry[]>(`/cases/${id}/activities`),
        api.get<{ items: AssignmentRow[] }>(`/cases/${id}/assignments`),
      ]);
      setData(detail);
      setActivities(acts);
      setAssignments(asgns.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در دریافت پرونده');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  const runAction = async (fn: () => Promise<unknown>, successMessage: string) => {
    if (busyAction) return;
    setBusyAction(true);
    try {
      await fn();
      toast.success(successMessage);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطای غیرمنتظره');
    } finally {
      setBusyAction(false);
    }
  };

  const openAttachment = async (file: CaseFile) => {
    setPreviewLoading(true);
    try {
      if (file.mimeType.startsWith('image/') || file.mimeType.startsWith('audio/') || file.mimeType === 'application/pdf') {
        const { url, type } = await getFileObjectUrl(`/files/${file.id}/download`);
        if (type === 'application/pdf') {
          window.open(url, '_blank', 'noopener');
          window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
        } else {
          setPreview({ url, type, name: file.filename });
        }
      } else {
        await downloadFile(`/files/${file.id}/download`, file.filename);
        toast.success('فایل دانلود شد');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در باز کردن فایل');
    } finally {
      setPreviewLoading(false);
    }
  };

  if (loading) return <Spinner label="در حال دریافت پرونده…" />;
  if (error) {
    return (
      <div className="space-y-5">
        <ErrorState message={error} onRetry={load} />
        <div className="flex justify-center">
          <Link href="/cases?mine=true" className={btnSecondary}>
            <ArrowLeftIcon className="h-4 w-4 rotate-180" />
            بازگشت به کارهای من
          </Link>
        </div>
      </div>
    );
  }
  if (!data) return null;

  const isClosed = data.status === 'DONE' || data.status === 'CANCELLED';
  const late = isLate(data.dueDate, data.status);
  const effortMinutes = activities.reduce(
    (sum, item) => sum + (typeof item.payload?.effortMinutes === 'number' ? item.payload.effortMinutes : 0),
    0,
  );
  const activeReminder = (data.reminders ?? []).find((reminder) => reminder.status === 'ACTIVE');

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="اجرای پرونده"
        title={data.title}
        description="مرکز انجام کار، ثبت نتیجه، پیگیری بعدی، انتقال مسئولیت و مستندات این پرونده."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <span className="tnum rounded-lg border border-workspace-border bg-workspace-elevated px-2.5 py-1 text-workspace-muted">
              پرونده #{toFa(data.number)}
            </span>
            <StatusBadge status={data.status} />
            <PriorityBadge priority={data.priority} />
          </div>
        }
        icon={<CasesIcon className="h-5 w-5" />}
        actions={
          <Link href="/cases?mine=true" className={btnSecondary}>
            <ArrowLeftIcon className="h-4 w-4 rotate-180" />
            کارهای من
          </Link>
        }
      />

      {data.hasPendingAcceptanceForMe && data.status === 'WAITING_ACCEPTANCE' && (
        <Card className="overflow-hidden border-amber-400/25 bg-amber-400/[0.05]">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-amber-100">این پرونده برای شما ارجاع شده است</p>
              <p className="mt-1 text-xs leading-6 text-amber-200/70">پیش از شروع پیگیری، مسئولیت پرونده را بپذیرید یا با ذکر دلیل رد کنید.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => void runAction(() => api.post(`/cases/${id}/accept`), 'پرونده پذیرفته شد')}
                disabled={busyAction}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-60"
              >
                <CheckIcon className="h-4 w-4" />
                پذیرش مسئولیت
              </button>
              <button
                onClick={() => setModal('reject')}
                disabled={busyAction}
                className="inline-flex items-center gap-2 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-2.5 text-xs font-bold text-red-200 transition hover:bg-red-400/15 disabled:opacity-60"
              >
                رد ارجاع
              </button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewItem icon={<EmployeesIcon className="h-4 w-4" />} label="مسئول فعلی">
          {data.currentOwner ? `${data.currentOwner.firstName} ${data.currentOwner.lastName}` : 'در انتظار پذیرش'}
        </OverviewItem>
        <OverviewItem icon={<CalendarIcon className="h-4 w-4" />} label="سررسید" tone={late ? 'danger' : 'default'}>
          {data.dueDate ? faDate(data.dueDate) : 'بدون سررسید'}
        </OverviewItem>
        <OverviewItem icon={<ActivityIcon className="h-4 w-4" />} label="زمان ثبت‌شده">
          {effortMinutes > 0 ? `${toFa(effortMinutes)} دقیقه` : 'ثبت نشده'}
        </OverviewItem>
        <OverviewItem icon={<FileIcon className="h-4 w-4" />} label="مستندات">
          {toFa(data.files.length)} فایل
        </OverviewItem>
      </div>

      {!isClosed && data.canEdit && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <button onClick={() => setModal('result')} className={btnPrimary.replace('w-full', '')}>
              <ResultIcon className="h-4 w-4" />
              ثبت نتیجه پیگیری
            </button>
            {data.canTransfer && (
              <button onClick={() => setModal('transfer')} className={btnSecondary}>
                <TransferIcon className="h-4 w-4" />
                انتقال به همکار
              </button>
            )}
            <input
              ref={fileInput}
              type="file"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const formData = new FormData();
                formData.append('file', file);
                void runAction(() => api.post(`/cases/${id}/files`, formData), 'فایل به پرونده پیوست شد');
                event.target.value = '';
              }}
            />
            <button onClick={() => fileInput.current?.click()} disabled={busyAction} className={btnSecondary}>
              <UploadIcon className="h-4 w-4" />
              پیوست فایل
            </button>
            <p className="w-full pt-1 text-[10px] leading-6 text-workspace-soft lg:mr-auto lg:w-auto lg:pt-0">
              زمان صرف‌شده و پیگیری بعدی داخل «ثبت نتیجه» ثبت می‌شوند؛ تایمر شروع/پایان در جریان جدید استفاده نمی‌شود.
            </p>
          </div>
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(310px,.75fr)]">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <PanelHeader title="شرح و نتیجه" description="موضوع پرونده و آخرین خروجی ثبت‌شده" />
            <div className="space-y-4 p-5">
              <section>
                <p className="mb-2 text-[10px] font-semibold text-workspace-soft">شرح اولیه</p>
                <p className="whitespace-pre-wrap rounded-xl border border-workspace-border bg-workspace-elevated/50 px-4 py-3.5 text-xs leading-7 text-workspace-muted">
                  {data.description || 'شرح تکمیلی برای این پرونده ثبت نشده است.'}
                </p>
              </section>
              {data.result && (
                <section>
                  <p className="mb-2 text-[10px] font-semibold text-workspace-soft">آخرین نتیجه ثبت‌شده</p>
                  <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3.5">
                    <p className="whitespace-pre-wrap text-xs leading-7 text-emerald-100">{data.result}</p>
                    {data.resultAt && <p className="tnum mt-2 text-[10px] text-emerald-300/70">{faDateTime(data.resultAt)}</p>}
                  </div>
                </section>
              )}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <PanelHeader title="خط زمان پیگیری" description="تمام نتیجه‌ها، یادآوری‌ها و تغییرات پرونده" />
            <div className="p-5">
              <ActivityTimeline items={activities} />
            </div>
          </Card>
        </div>

        <aside className="space-y-5">
          {activeReminder && (
            <Card className="overflow-hidden border-amber-400/20">
              <PanelHeader title="پیگیری بعدی" description="یادآوری فعال این پرونده" />
              <div className="p-5">
                <p className="tnum text-sm font-black text-amber-200">{faDateTime(activeReminder.remindAt)}</p>
                {activeReminder.note && <p className="mt-2 text-xs leading-7 text-workspace-muted">{activeReminder.note}</p>}
              </div>
            </Card>
          )}

          <Card className="overflow-hidden">
            <PanelHeader title="گردش مسئولیت" description={`${toFa(assignments.length)} رکورد ارجاع`} />
            <div className="p-4">
              <AssignmentHistory items={assignments} />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <PanelHeader title="زمینه پرونده" />
            <div className="space-y-3 p-5">
              <ContextRow label="نوع پرونده" value={data.caseType?.name ?? 'بدون نوع'} />
              <ContextRow label="مشتری" value={data.customer ? `${data.customer.name}${data.customer.isActive ? '' : ' · بایگانی'}` : 'بدون مشتری'} />
              <ContextRow label="ایجادکننده" value={`${data.createdBy.firstName} ${data.createdBy.lastName}`} />
              <ContextRow label="زمان ایجاد" value={faDateTime(data.createdAt)} />
            </div>
          </Card>
        </aside>
      </div>

      <Card className="overflow-hidden">
        <PanelHeader
          title="فایل‌ها و مستندات"
          description={data.canEdit && !isClosed ? 'برای ثبت سند جدید از دکمه «پیوست فایل» در نوار عملیات استفاده کنید.' : 'مستندات ثبت‌شده پرونده'}
        />
        {data.files.length === 0 ? (
          <EmptyState title="فایلی پیوست نشده است" hint="سند، تصویر، PDF یا صوت مرتبط با پیگیری را می‌توانید به پرونده اضافه کنید." />
        ) : (
          <div className="divide-y divide-workspace-border">
            {data.files.map((file) => (
              <div key={file.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 transition hover:bg-workspace-hover/40 sm:px-5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-workspace-border bg-workspace-elevated text-workspace-muted">
                  <FileIcon className="h-4 w-4" />
                </span>
                <button onClick={() => void openAttachment(file)} className="min-w-0 flex-1 text-right">
                  <p className="truncate text-xs font-bold text-workspace-ink hover:text-brand-200">{file.filename}</p>
                  <p className="mt-1 text-[10px] text-workspace-soft">
                    {file.uploader.firstName} {file.uploader.lastName} · {fileKindLabel(file.mimeType)} · {toFa(Math.max(1, Math.round(file.size / 1024)))} کیلوبایت
                  </p>
                </button>
                <span className="tnum hidden text-[10px] text-workspace-soft md:block">{faDateTime(file.createdAt)}</span>
                <button
                  type="button"
                  onClick={() => void downloadFile(`/files/${file.id}/download`, file.filename).then(() => toast.success('فایل دانلود شد')).catch((err) => toast.error(err instanceof Error ? err.message : 'خطا در دانلود'))}
                  className={btnSecondary}
                >
                  <DownloadIcon className="h-4 w-4" />
                  دانلود
                </button>
              </div>
            ))}
          </div>
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
          <div className="mt-4 flex justify-end">
            <a href={preview.url} download={preview.name} className={btnSecondary}>
              <DownloadIcon className="h-4 w-4" />
              ذخیره فایل
            </a>
          </div>
        </Modal>
      )}

      <RejectModal open={modal === 'reject'} onClose={() => setModal('')} caseId={id} onDone={load} />
      <ResultModal open={modal === 'result'} onClose={() => setModal('')} caseId={id} onDone={load} />
      <CaseTransferModal
        open={modal === 'transfer'}
        onClose={() => setModal('')}
        caseId={id}
        onDone={load}
      />
    </div>
  );
}

function OverviewItem({
  icon,
  label,
  children,
  tone = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  tone?: 'default' | 'danger';
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-workspace-soft">
        {icon}
        <p className="text-[10px] font-semibold">{label}</p>
      </div>
      <p className={`tnum mt-2 truncate text-xs font-black ${tone === 'danger' ? 'text-red-300' : 'text-workspace-ink'}`}>{children}</p>
    </Card>
  );
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-workspace-border pt-3 first:border-0 first:pt-0">
      <span className="text-[10px] text-workspace-soft">{label}</span>
      <span className="max-w-[65%] text-left text-[11px] font-semibold leading-6 text-workspace-muted">{value}</span>
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
  onDone: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title="رد کردن ارجاع">
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          try {
            await api.post(`/cases/${caseId}/reject`, { reason: reason.trim() });
            toast.success('ارجاع رد شد و پرونده به فرستنده بازگشت');
            setReason('');
            onClose();
            await onDone();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'خطا در رد ارجاع');
          } finally {
            setBusy(false);
          }
        }}
        className="space-y-4"
      >
        <div className="rounded-xl border border-red-400/20 bg-red-400/[0.06] px-3.5 py-3 text-[11px] leading-6 text-red-200/80">
          دلیل رد در تاریخچه پرونده ثبت می‌شود و مسئولیت به فرستنده ارجاع بازمی‌گردد.
        </div>
        <Field label="دلیل رد" required>
          <textarea
            className={`${inputClass} min-h-28`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={1000}
            placeholder="دلیل مشخص و قابل پیگیری را ثبت کنید…"
            autoFocus
          />
        </Field>
        <button disabled={busy || reason.trim().length < 3} className="inline-flex w-full items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-500 disabled:opacity-60">
          {busy ? 'در حال ثبت…' : 'ثبت رد ارجاع'}
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
}: {
  open: boolean;
  onClose: () => void;
  caseId: string;
  onDone: () => void | Promise<void>;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [result, setResult] = useState('');
  const [effortMinutes, setEffortMinutes] = useState('');
  const [complete, setComplete] = useState(false);
  const [createNextReminder, setCreateNextReminder] = useState(false);
  const [reminderDate, setReminderDate] = useState(() => faDateInput(new Date(Date.now() + 86_400_000)));
  const [reminderTime, setReminderTime] = useState('09:00');
  const [reminderNote, setReminderNote] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const effort = Number(effortMinutes);
    if (!Number.isInteger(effort) || effort < 1 || effort > 1440) {
      toast.error('زمان صرف‌شده را بین ۱ تا ۱۴۴۰ دقیقه وارد کنید');
      return;
    }

    if (complete) {
      const approved = await confirm({
        title: 'تکمیل پرونده',
        message: 'با تکمیل، پرونده بسته می‌شود و ادامه عملیات روی آن متوقف خواهد شد.',
        confirmLabel: 'تکمیل پرونده',
      });
      if (!approved) return;
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
        result: result.trim(),
        complete,
        effortMinutes: effort,
        ...(nextReminder ? { nextReminder } : {}),
      });
      toast.success(
        complete
          ? 'نتیجه ثبت و پرونده تکمیل شد'
          : nextReminder
            ? 'نتیجه و یادآوری بعدی ثبت شد'
            : 'نتیجه پیگیری ثبت شد',
      );
      setResult('');
      setEffortMinutes('');
      setComplete(false);
      setCreateNextReminder(false);
      setReminderNote('');
      setReminderDate(faDateInput(new Date(Date.now() + 86_400_000)));
      setReminderTime('09:00');
      onClose();
      await onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ثبت نتیجه');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="ثبت نتیجه پیگیری">
      <form onSubmit={submit} className="space-y-4">
        <Field label="نتیجه پیگیری" required>
          <textarea
            className={`${inputClass} min-h-32`}
            value={result}
            onChange={(event) => setResult(event.target.value)}
            maxLength={5000}
            placeholder="چه کاری انجام شد، چه پاسخی دریافت شد و گام بعدی چیست؟"
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
            onChange={(event) => setEffortMinutes(event.target.value)}
            placeholder="مثلاً ۲۰"
          />
        </Field>
        <p className="text-[10px] leading-6 text-workspace-soft">
          این مقدار زمان واقعی صرف‌شده برای همین مرحله پیگیری است و جایگزین تایمر شروع/پایان شده است.
        </p>

        <label className="flex items-center gap-2 rounded-xl border border-workspace-border bg-workspace-elevated/60 px-3.5 py-3 text-xs font-semibold text-workspace-muted">
          <input
            type="checkbox"
            checked={complete}
            onChange={(event) => {
              setComplete(event.target.checked);
              if (event.target.checked) setCreateNextReminder(false);
            }}
            className="accent-brand-500"
          />
          موضوع کاملاً بسته شده و پرونده تکمیل شود
        </label>

        {!complete && (
          <div className="rounded-xl border border-workspace-border bg-workspace-elevated/40 p-3.5">
            <label className="flex items-center gap-2 text-xs font-semibold text-workspace-muted">
              <input
                type="checkbox"
                checked={createNextReminder}
                onChange={(event) => setCreateNextReminder(event.target.checked)}
                className="accent-brand-500"
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
                      onChange={(event) => setReminderDate(event.target.value)}
                      placeholder="۱۴۰۵/۰۶/۰۷"
                    />
                  </Field>
                  <Field label="ساعت" required>
                    <input
                      type="time"
                      dir="ltr"
                      className={inputClass}
                      value={reminderTime}
                      onChange={(event) => setReminderTime(event.target.value)}
                    />
                  </Field>
                </div>
                <Field label="یادداشت پیگیری بعدی">
                  <input
                    className={inputClass}
                    value={reminderNote}
                    onChange={(event) => setReminderNote(event.target.value)}
                    maxLength={1000}
                    placeholder="مثلاً: تماس برای تأیید قرارداد"
                  />
                </Field>
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

function fileKindLabel(mimeType: string) {
  if (mimeType.startsWith('image/')) return 'تصویر';
  if (mimeType.startsWith('audio/')) return 'صوت';
  if (mimeType === 'application/pdf') return 'PDF';
  return 'فایل';
}
