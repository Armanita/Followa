'use client';

import { faDateTime, faDuration, toFa } from '@/lib/jalali';
import { ACTIVITY_LABELS } from '@/lib/labels';

const ICONS: Record<string, string> = {
  CREATE: '🆕',
  ASSIGN: '📤',
  ACCEPT: '✅',
  REJECT: '⛔',
  START_WORK: '▶️',
  END_WORK: '⏹️',
  RESULT_ADDED: '📝',
  FILE_UPLOADED: '📎',
  COMPLETE: '🏁',
  CANCEL: '🚫',
  REMINDER_CREATED: '⏰',
  REMINDER_DONE: '🔔',
};

export interface TimelineEntry {
  id: string;
  type: string;
  createdAt: string;
  payload?: Record<string, unknown> | null;
  actor?: { id: string; firstName: string; lastName: string } | null;
}

export function ActivityTimeline({ items }: { items: TimelineEntry[] }) {
  if (!items.length) return <p className="py-6 text-center text-sm text-slate-400">فعالیتی ثبت نشده است</p>;
  const sorted = [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return (
    <ol className="relative space-y-0 border-r-2 border-slate-100 pr-5">
      {sorted.map((item) => (
        <li key={item.id} className="relative pb-6 last:pb-0">
          <span className="absolute -right-[31px] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs ring-2 ring-slate-100">
            {ICONS[item.type] ?? '•'}
          </span>
          <div>
            <p className="text-sm font-medium text-slate-800">
              {ACTIVITY_LABELS[item.type] ?? item.type}
              {item.actor && (
                <span className="font-normal text-slate-500">
                  {' — '}
                  {item.actor.firstName} {item.actor.lastName}
                </span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">{faDateTime(item.createdAt)}</p>
            {item.type === 'RESULT_ADDED' && typeof item.payload?.result === 'string' && (
              <p className="mt-2 whitespace-pre-wrap rounded-lg bg-emerald-50 px-3 py-2 text-sm leading-relaxed text-emerald-900">
                {String(item.payload.result)}
              </p>
            )}
            {item.type === 'RESULT_ADDED' && typeof item.payload?.effortMinutes === 'number' && (
              <p className="tnum mt-1 text-xs text-slate-500">
                زمان صرف‌شده اعلامی: {toFa(item.payload.effortMinutes as number)} دقیقه
              </p>
            )}
            {item.type === 'REJECT' && typeof item.payload?.rejectReason === 'string' && (
              <p className="mt-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">
                دلیل رد: {String(item.payload.rejectReason)}
              </p>
            )}
            {(item.type === 'END_WORK' || item.type === 'START_WORK') &&
              typeof item.payload?.durationSeconds === 'number' && (
                <p className="tnum mt-1 text-xs text-slate-500">
                  مدت: {faDuration(item.payload.durationSeconds as number)}
                </p>
              )}
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
  if (!items.length)
    return <p className="py-6 text-center text-sm text-slate-400">ارجاعی ثبت نشده است</p>;
  return (
    <div className="space-y-3">
      {[...items].reverse().map((a) => (
        <div key={a.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="rounded-md bg-white px-2 py-0.5 text-xs font-medium ring-1 ring-slate-200">
              {a.reason === 'INITIAL_ASSIGNMENT'
                ? 'ارجاع اولیه'
                : a.reason === 'TRANSFER'
                  ? 'انتقال'
                  : 'بازگشت (رد)'}
            </span>
            <span className="text-slate-600">
              {a.fromUs ? `${a.fromUs.firstName} ${a.fromUs.lastName}` : 'سیستم'}
            </span>
            <span className="text-slate-300">←</span>
            <span className="font-medium text-slate-800">
              {a.toUs?.firstName} {a.toUs?.lastName}
            </span>
            <span
              className={`mr-auto rounded-full px-2 py-0.5 text-xs font-medium ${
                a.status === 'ACCEPTED'
                  ? 'bg-emerald-50 text-emerald-700'
                  : a.status === 'REJECTED'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-amber-50 text-amber-700'
              }`}
            >
              {a.status === 'ACCEPTED' ? 'پذیرفته شد' : a.status === 'REJECTED' ? 'رد شد' : 'در انتظار'}
            </span>
          </div>
          {a.note && <p className="mt-2 text-xs text-slate-500">توضیح: {a.note}</p>}
          {a.rejectReason && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">
              دلیل رد: {a.rejectReason}
            </p>
          )}
          <p className="tnum mt-2 text-xs text-slate-400">
            {faDateTime(a.createdAt)}
            {a.respondedAt && ` · پاسخ: ${faDateTime(a.respondedAt)}`}
          </p>
        </div>
      ))}
    </div>
  );
}

export function CaseStatusChart({ data }: { data: { status: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const labels: Record<string, string> = {
    OPEN: 'باز',
    WAITING_ACCEPTANCE: 'در انتظار پذیرش',
    IN_PROGRESS: 'در حال انجام',
    DONE: 'تکمیل شده',
    CANCELLED: 'لغو شده',
  };
  const colors: Record<string, string> = {
    OPEN: '#0ea5e9',
    WAITING_ACCEPTANCE: '#f59e0b',
    IN_PROGRESS: '#3b76f6',
    DONE: '#10b981',
    CANCELLED: '#94a3b8',
  };
  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
        {data
          .filter((d) => d.count > 0)
          .map((d) => (
            <div
              key={d.status}
              style={{ width: `${(d.count / total) * 100}%`, backgroundColor: colors[d.status] }}
            />
          ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {data.map((d) => (
          <div key={d.status} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[d.status] }} />
            {labels[d.status]}{' '}
            <span className="tnum font-semibold">{toFa(d.count)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
