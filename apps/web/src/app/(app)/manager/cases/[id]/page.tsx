'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, downloadFile, getFileObjectUrl } from '@/lib/api';
import {
  btnPrimary,
  btnSecondary,
  Card,
  EmptyState,
  ErrorState,
  Modal,
  PriorityBadge,
  Spinner,
  StatusBadge,
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
  ClockIcon,
  CustomersIcon,
  DownloadIcon,
  EmployeesIcon,
  FileIcon,
  TransferIcon,
} from '@/components/workspace/icons';
import { Avatar, PageHeader, PanelHeader } from '@/components/workspace/page';
import { faDate, faDateTime, faDuration, isLate, toFa } from '@/lib/jalali';

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
  canTransfer: boolean;
  isManager: boolean;
  totalWorkSeconds: number;
  currentOwner?: { id: string; firstName: string; lastName: string } | null;
  createdBy: { id: string; firstName: string; lastName: string };
  caseType?: { id: string; name: string; color: string | null } | null;
  customer?: { id: string; type: 'INDIVIDUAL' | 'LEGAL'; name: string; isActive: boolean } | null;
  reminders?: CaseReminder[];
  files: CaseFile[];
}

export default function ManagerCaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [data, setData] = useState<CaseDetail | null>(null);
  const [activities, setActivities] = useState<TimelineEntry[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [transferOpen, setTransferOpen] = useState(false);
  const [preview, setPreview] = useState<{ url: string; type: string; name: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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
          <Link href="/cases" className={btnSecondary}>
            <ArrowLeftIcon className="h-4 w-4 rotate-180" />
            بازگشت به پرونده‌ها
          </Link>
        </div>
      </div>
    );
  }
  if (!data) return null;

  const late = isLate(data.dueDate, data.status);
  const effortMinutes = activities.reduce(
    (sum, item) => sum + (typeof item.payload?.effortMinutes === 'number' ? item.payload.effortMinutes : 0),
    0,
  );
  const activeReminder = (data.reminders ?? []).find((reminder) => reminder.status === 'ACTIVE');

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="نظارت مدیریتی پرونده"
        title={data.title}
        description="نمای یکپارچه وضعیت، گردش مسئولیت، نتیجه‌ها، زمان صرف‌شده و مستندات پرونده."
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
          <>
            <Link href="/cases" className={btnSecondary}>
              <ArrowLeftIcon className="h-4 w-4 rotate-180" />
              پرونده‌ها
            </Link>
            {data.canTransfer && (
              <button onClick={() => setTransferOpen(true)} className={btnPrimary.replace('w-full', '')}>
                <TransferIcon className="h-4 w-4" />
                {data.status === 'WAITING_ACCEPTANCE' ? 'ارجاع مجدد' : 'انتقال پرونده'}
              </button>
            )}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <OverviewItem icon={<EmployeesIcon className="h-4 w-4" />} label="مسئول فعلی">
          {data.currentOwner ? `${data.currentOwner.firstName} ${data.currentOwner.lastName}` : 'در انتظار پذیرش'}
        </OverviewItem>
        <OverviewItem icon={<CalendarIcon className="h-4 w-4" />} label="سررسید" tone={late ? 'danger' : 'default'}>
          {data.dueDate ? faDate(data.dueDate) : 'بدون سررسید'}
        </OverviewItem>
        <OverviewItem icon={<ClockIcon className="h-4 w-4" />} label="زمان اعلامی نتایج">
          {effortMinutes > 0 ? `${toFa(effortMinutes)} دقیقه` : 'ثبت نشده'}
        </OverviewItem>
        <OverviewItem icon={<ActivityIcon className="h-4 w-4" />} label="رویدادها">
          {toFa(activities.length)} رویداد
        </OverviewItem>
        <OverviewItem icon={<FileIcon className="h-4 w-4" />} label="مستندات">
          {toFa(data.files.length)} فایل
        </OverviewItem>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(310px,.75fr)]">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <PanelHeader title="شرح و نتیجه پرونده" description="تصویر فعلی از موضوع و آخرین نتیجه ثبت‌شده" />
            <div className="space-y-4 p-5">
              <section>
                <p className="mb-2 text-[10px] font-semibold text-workspace-soft">شرح اولیه</p>
                <p className="whitespace-pre-wrap rounded-xl border border-workspace-border bg-workspace-elevated/50 px-4 py-3.5 text-xs leading-7 text-workspace-muted">
                  {data.description || 'شرح تکمیلی برای این پرونده ثبت نشده است.'}
                </p>
              </section>
              <section>
                <p className="mb-2 text-[10px] font-semibold text-workspace-soft">آخرین نتیجه</p>
                {data.result ? (
                  <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3.5">
                    <p className="whitespace-pre-wrap text-xs leading-7 text-emerald-100">{data.result}</p>
                    {data.resultAt && <p className="tnum mt-2 text-[10px] text-emerald-300/70">{faDateTime(data.resultAt)}</p>}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-workspace-borderStrong px-4 py-4 text-xs text-workspace-soft">
                    هنوز نتیجه‌ای برای این پرونده ثبت نشده است.
                  </p>
                )}
              </section>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <PanelHeader title="خط زمان عملیاتی" description="رویدادها، نتیجه‌های مرحله‌ای، یادآوری‌ها و تغییرات ثبت‌شده" />
            <div className="p-5">
              <ActivityTimeline items={activities} />
            </div>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card className="overflow-hidden">
            <PanelHeader title="گردش مسئولیت" description={`${toFa(assignments.length)} رکورد ارجاع`} />
            <div className="p-4">
              <AssignmentHistory items={assignments} />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <PanelHeader title="اطلاعات پرونده" description="زمینه و مالکیت سازمانی" />
            <div className="space-y-4 p-5">
              <div className="flex items-center gap-3">
                <Avatar name={`${data.createdBy.firstName} ${data.createdBy.lastName}`} />
                <div className="min-w-0">
                  <p className="text-[10px] text-workspace-soft">ایجادکننده</p>
                  <p className="truncate text-xs font-bold text-workspace-ink">{data.createdBy.firstName} {data.createdBy.lastName}</p>
                  <p className="tnum mt-1 text-[10px] text-workspace-soft">{faDateTime(data.createdAt)}</p>
                </div>
              </div>
              <ContextRow label="نوع پرونده" value={data.caseType?.name ?? 'بدون نوع'} />
              <ContextRow
                label="مشتری"
                value={data.customer ? `${data.customer.name}${data.customer.isActive ? '' : ' · بایگانی'}` : 'بدون مشتری'}
                icon={<CustomersIcon className="h-3.5 w-3.5" />}
              />
              {activeReminder && (
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3.5 py-3">
                  <p className="text-[10px] font-semibold text-amber-300">یادآوری فعال بعدی</p>
                  <p className="tnum mt-1 text-xs font-bold text-amber-100">{faDateTime(activeReminder.remindAt)}</p>
                  {activeReminder.note && <p className="mt-1 text-[11px] leading-6 text-amber-200/80">{activeReminder.note}</p>}
                </div>
              )}
              {data.totalWorkSeconds > 0 && (
                <ContextRow label="سابقه تایمر قدیمی" value={faDuration(data.totalWorkSeconds)} />
              )}
            </div>
          </Card>
        </aside>
      </div>

      <Card className="overflow-hidden">
        <PanelHeader title="فایل‌ها و مستندات" description="مستندات احراز هویت‌شده مرتبط با پرونده" />
        {data.files.length === 0 ? (
          <EmptyState title="فایلی پیوست نشده است" hint="فایل‌هایی که کارکنان در جریان پیگیری ثبت می‌کنند اینجا نمایش داده می‌شوند." />
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

      <CaseTransferModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        caseId={id}
        onDone={load}
        title="انتقال / ارجاع مجدد پرونده"
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

function ContextRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-workspace-border pt-3 first:border-0 first:pt-0">
      <span className="flex items-center gap-1.5 text-[10px] text-workspace-soft">{icon}{label}</span>
      <span className="max-w-[65%] text-left text-[11px] font-semibold leading-6 text-workspace-muted">{value}</span>
    </div>
  );
}

function fileKindLabel(mimeType: string) {
  if (mimeType.startsWith('image/')) return 'تصویر';
  if (mimeType.startsWith('audio/')) return 'صوت';
  if (mimeType === 'application/pdf') return 'PDF';
  return 'فایل';
}
