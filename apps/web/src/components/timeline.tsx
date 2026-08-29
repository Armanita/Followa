'use client';

import { ActivityIcon } from '@/components/workspace/icons';
import { faDateTime, faDuration, toFa } from '@/lib/jalali';
import { ACTIVITY_LABELS } from '@/lib/labels';

const EVENT_TONE: Record<string, string> = {
  CREATE: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
  ASSIGN: 'border-indigo-400/20 bg-indigo-400/10 text-indigo-300',
  ACCEPT: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  REJECT: 'border-red-400/20 bg-red-400/10 text-red-300',
  RESULT_ADDED: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  FILE_UPLOADED: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-300',
  COMPLETE: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  CANCEL: 'border-red-400/20 bg-red-400/10 text-red-300',
  REMINDER_CREATED: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  REMINDER_DONE: 'border-violet-400/20 bg-violet-400/10 text-violet-300',
};

export interface TimelineEntry {
  id: string;
  type: string;
  createdAt: string;
  payload?: Record<string, unknown> | null;
  actor?: { id: string; firstName: string; lastName: string } | null;
}

export function ActivityTimeline({ items }: { items: TimelineEntry[] }) {
  if (!items.length) return <p className="py-6 text-center text-xs text-workspace-soft">فعالیتی ثبت نشده است</p>;
  const sorted = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return (
    <ol className="relative space-y-0 border-r border-workspace-border pr-6">
      {sorted.map((item) => (
        <li key={item.id} className="relative pb-6 last:pb-0">
          <span className={`absolute -right-[37px] top-0 grid h-7 w-7 place-items-center rounded-xl border bg-workspace-surface ${EVENT_TONE[item.type] ?? 'border-workspace-border text-workspace-muted'}`}><ActivityIcon className="h-3.5 w-3.5" /></span>
          <div>
            <p className="text-xs font-bold text-workspace-ink">{ACTIVITY_LABELS[item.type] ?? item.type}{item.actor && <span className="font-normal text-workspace-muted">{' — '}{item.actor.firstName} {item.actor.lastName}</span>}</p>
            <p className="mt-1 text-[10px] text-workspace-soft">{faDateTime(item.createdAt)}</p>
            {item.type === 'RESULT_ADDED' && typeof item.payload?.result === 'string' && <p className="mt-2 whitespace-pre-wrap rounded-xl border border-emerald-400/15 bg-emerald-400/5 px-3 py-2 text-xs leading-6 text-emerald-100">{String(item.payload.result)}</p>}
            {item.type === 'RESULT_ADDED' && typeof item.payload?.effortMinutes === 'number' && <p className="tnum mt-1 text-[10px] text-workspace-muted">زمان صرف‌شده اعلامی: {toFa(item.payload.effortMinutes as number)} دقیقه</p>}
            {item.type === 'REJECT' && typeof item.payload?.rejectReason === 'string' && <p className="mt-2 rounded-xl border border-red-400/15 bg-red-400/5 px-3 py-2 text-xs text-red-200">دلیل رد: {String(item.payload.rejectReason)}</p>}
            {(item.type === 'END_WORK' || item.type === 'START_WORK') && typeof item.payload?.durationSeconds === 'number' && <p className="tnum mt-1 text-[10px] text-workspace-muted">مدت: {faDuration(item.payload.durationSeconds as number)}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export interface AssignmentRow {
  id: string;
  reason: string;
  status: string;
  note: string | null;
  rejectReason: string | null;
  createdAt: string;
  respondedAt: string | null;
  fromUs?: { id: string; firstName: string; lastName: string } | null;
  toUs?: { id: string; firstName: string; lastName: string } | null;
}

export function AssignmentHistory({ items }: { items: AssignmentRow[] }) {
  if (!items.length) return <p className="py-6 text-center text-xs text-workspace-soft">ارجاعی ثبت نشده است</p>;
  return (
    <div className="space-y-3">
      {[...items].reverse().map((a) => (
        <div key={a.id} className="rounded-xl border border-workspace-border bg-workspace-elevated/60 p-3.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="rounded-lg border border-workspace-borderStrong bg-workspace-surface px-2 py-1 text-[10px] font-semibold text-workspace-muted">{a.reason === 'INITIAL_ASSIGNMENT' ? 'ارجاع اولیه' : a.reason === 'TRANSFER' ? 'انتقال' : 'بازگشت (رد)'}</span>
            <span className="text-workspace-muted">{a.fromUs ? `${a.fromUs.firstName} ${a.fromUs.lastName}` : 'سیستم'}</span>
            <span className="text-workspace-soft">←</span>
            <span className="font-bold text-workspace-ink">{a.toUs?.firstName} {a.toUs?.lastName}</span>
            <span className={`mr-auto rounded-full border px-2 py-1 text-[10px] font-semibold ${a.status === 'ACCEPTED' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : a.status === 'REJECTED' ? 'border-red-400/20 bg-red-400/10 text-red-300' : 'border-amber-400/20 bg-amber-400/10 text-amber-300'}`}>{a.status === 'ACCEPTED' ? 'پذیرفته شد' : a.status === 'REJECTED' ? 'رد شد' : 'در انتظار'}</span>
          </div>
          {a.note && <p className="mt-2 text-[11px] text-workspace-muted">توضیح: {a.note}</p>}
          {a.rejectReason && <p className="mt-2 rounded-lg border border-red-400/15 bg-red-400/5 px-3 py-1.5 text-[11px] text-red-200">دلیل رد: {a.rejectReason}</p>}
          <p className="tnum mt-2 text-[10px] text-workspace-soft">{faDateTime(a.createdAt)}{a.respondedAt && ` · پاسخ: ${faDateTime(a.respondedAt)}`}</p>
        </div>
      ))}
    </div>
  );
}

export function CaseStatusChart({ data }: { data: { status: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const labels: Record<string, string> = { OPEN: 'باز', WAITING_ACCEPTANCE: 'در انتظار پذیرش', IN_PROGRESS: 'در حال انجام', DONE: 'تکمیل شده', CANCELLED: 'لغو شده' };
  const colors: Record<string, string> = { OPEN: '#38bdf8', WAITING_ACCEPTANCE: '#f59e0b', IN_PROGRESS: '#818cf8', DONE: '#34d399', CANCELLED: '#64748b' };
  return (
    <div className="space-y-4">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-workspace-elevated">
        {data.filter((d) => d.count > 0).map((d) => <div key={d.status} style={{ width: `${(d.count / total) * 100}%`, backgroundColor: colors[d.status] }} />)}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {data.map((d) => <div key={d.status} className="flex items-center gap-2 text-[11px] text-workspace-muted"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[d.status] }} /><span className="flex-1">{labels[d.status]}</span><span className="tnum font-bold text-workspace-ink">{toFa(d.count)}</span></div>)}
      </div>
    </div>
  );
}
