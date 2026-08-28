'use client';

import Link from 'next/link';
import { ActivityTimeline, CaseStatusChart } from '@/components/timeline';
import { FolderIcon } from '@/components/workspace/icons';
import { isLate, toFa } from '@/lib/jalali';
import { CASE_STATUS_LABELS, PRIORITY_LABELS } from '@/lib/labels';

interface ManagerCards {
  totalCases: number;
  openCases: number;
  inProgress: number;
  waitingAcceptance: number;
  lateCases: number;
  activeEmployees: number;
}

interface UrgentCase {
  id: string;
  number?: number;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  currentOwner?: { firstName: string; lastName: string } | null;
  caseType?: { name: string } | null;
}

interface ActiveWorker {
  user: { firstName: string; lastName: string };
  case: { title: string };
}

interface ManagerDashboardData {
  cards: ManagerCards;
  urgentCases: UrgentCase[];
  statusChart: { status: string; count: number }[];
  activeWorkers: ActiveWorker[];
  recentActivities: any[];
}

interface ManagerDashboardProps {
  firstName: string;
  data: ManagerDashboardData;
}

const STATUS_TONES: Record<string, string> = {
  OPEN: 'bg-sky-50 text-sky-700 ring-sky-200',
  WAITING_ACCEPTANCE: 'bg-op-warning-soft text-op-warning ring-amber-200',
  IN_PROGRESS: 'bg-op-brand-soft text-op-brand ring-indigo-200',
  WAITING_APPROVAL: 'bg-violet-50 text-violet-700 ring-violet-200',
  DONE: 'bg-op-success-soft text-op-success ring-emerald-200',
  CANCELLED: 'bg-slate-100 text-slate-600 ring-slate-200',
};

const PRIORITY_TONES: Record<string, string> = {
  LOW: 'bg-slate-50 text-slate-600 ring-slate-200',
  HIGH: 'bg-orange-50 text-orange-700 ring-orange-200',
  URGENT: 'bg-op-danger-soft text-op-danger ring-red-200',
};

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-workspace-border bg-workspace-surface shadow-workspace ${className}`}>
      {children}
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${STATUS_TONES[status] ?? 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
      {CASE_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function PriorityPill({ priority }: { priority: string }) {
  if (priority === 'NORMAL') return null;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${PRIORITY_TONES[priority] ?? 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
      {PRIORITY_LABELS[priority] ?? priority}
    </span>
  );
}

function AttentionCard({ href, label, value, tone, hint }: { href: string; label: string; value: number; tone: 'danger' | 'warning' | 'brand'; hint: string }) {
  const tones = {
    danger: 'border-red-200 bg-red-50 text-op-danger',
    warning: 'border-amber-200 bg-amber-50 text-op-warning',
    brand: 'border-blue-200 bg-blue-50 text-op-brand',
  };

  return (
    <Link href={href} className={`group rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-workspace focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-op-brand/25 ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="mt-1 text-xs opacity-75">{hint}</p>
        </div>
        <strong className="tnum text-2xl font-extrabold leading-none">{toFa(value)}</strong>
      </div>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-workspace-border bg-workspace-surface p-4 shadow-workspace">
      <p className="text-xs font-medium text-workspace-ink-muted">{label}</p>
      <p className="tnum mt-2 text-2xl font-extrabold tracking-tight text-workspace-ink">{toFa(value)}</p>
    </div>
  );
}

export function ManagerDashboard({ firstName, data }: ManagerDashboardProps) {
  return (
    <div className="space-y-5 lg:space-y-6">
      <header className="rounded-2xl border border-workspace-border bg-workspace-surface p-5 shadow-workspace lg:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-op-brand">
              <span className="h-2 w-2 rounded-full bg-op-success" aria-hidden="true" />
              مرکز عملیات مدیریت
            </div>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-workspace-ink">سلام {firstName}</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-workspace-ink-muted">وضعیت پرونده‌ها، نقاط نیازمند توجه و جریان کار تیم در یک نگاه.</p>
          </div>
          <Link
            href="/cases"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-op-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-op-brand/30"
          >
            <FolderIcon className="h-5 w-5" />
            مشاهده پرونده‌ها
          </Link>
        </div>
      </header>

      <section aria-labelledby="attention-heading">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 id="attention-heading" className="text-base font-bold text-workspace-ink">نیازمند توجه</h2>
            <p className="mt-0.5 text-xs text-workspace-ink-muted">مواردی که بیشترین اثر را روی جریان کار امروز دارند.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <AttentionCard href="/cases" label="عقب‌افتاده" value={data.cards.lateCases} tone="danger" hint="پرونده‌های عبورکرده از سررسید" />
          <AttentionCard href="/cases?status=WAITING_ACCEPTANCE" label="در انتظار پذیرش" value={data.cards.waitingAcceptance} tone="warning" hint="ارجاع‌هایی که هنوز تعیین تکلیف نشده‌اند" />
          <AttentionCard href="/cases?status=IN_PROGRESS" label="در حال انجام" value={data.cards.inProgress} tone="brand" hint="پرونده‌های فعال در جریان اجرا" />
        </div>
      </section>

      <section aria-labelledby="kpi-heading">
        <div className="mb-3">
          <h2 id="kpi-heading" className="text-base font-bold text-workspace-ink">شاخص‌های عملیاتی</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Metric label="کل پرونده‌ها" value={data.cards.totalCases} />
          <Metric label="باز" value={data.cards.openCases} />
          <Metric label="در حال انجام" value={data.cards.inProgress} />
          <Metric label="در انتظار پذیرش" value={data.cards.waitingAcceptance} />
          <Metric label="عقب‌افتاده" value={data.cards.lateCases} />
          <Metric label="کارکنان فعال" value={data.cards.activeEmployees} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between gap-4 border-b border-workspace-border px-5 py-4">
            <div>
              <h2 className="text-base font-bold text-workspace-ink">پرونده‌های فوری</h2>
              <p className="mt-0.5 text-xs text-workspace-ink-muted">موارد با اولویت بالا که باید در دید مدیر بمانند.</p>
            </div>
            <Link href="/cases" className="shrink-0 text-xs font-semibold text-op-brand hover:underline">مشاهده همه</Link>
          </div>

          {data.urgentCases.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-semibold text-workspace-ink">پرونده فوری وجود ندارد</p>
              <p className="mt-1 text-xs text-workspace-ink-muted">در حال حاضر مورد فوری ثبت‌شده‌ای برای پیگیری نیست.</p>
            </div>
          ) : (
            <div className="divide-y divide-workspace-border">
              {data.urgentCases.map((item) => (
                <Link key={item.id} href={`/cases/${item.id}`} className="block px-5 py-4 transition hover:bg-workspace-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-op-brand/20">
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {typeof item.number === 'number' ? <span className="tnum text-xs font-bold text-workspace-ink-muted">#{toFa(item.number)}</span> : null}
                        <PriorityPill priority={item.priority} />
                        {isLate(item.dueDate, item.status) ? <span className="inline-flex rounded-full bg-op-danger-soft px-2.5 py-1 text-[11px] font-semibold text-op-danger ring-1 ring-inset ring-red-200">عقب‌افتاده</span> : null}
                      </div>
                      <p className="mt-2 truncate text-sm font-semibold text-workspace-ink">{item.title}</p>
                      <p className="mt-1 text-xs text-workspace-ink-muted">
                        مسئول: {item.currentOwner ? `${item.currentOwner.firstName} ${item.currentOwner.lastName}` : 'در انتظار پذیرش'}
                        {item.caseType ? ` · ${item.caseType.name}` : ''}
                      </p>
                    </div>
                    <StatusPill status={item.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel className="p-5">
            <div className="mb-4">
              <h2 className="text-base font-bold text-workspace-ink">وضعیت پرونده‌ها</h2>
              <p className="mt-0.5 text-xs text-workspace-ink-muted">توزیع فعلی پرونده‌ها بر اساس وضعیت.</p>
            </div>
            <CaseStatusChart data={data.statusChart} />
          </Panel>

          <Panel className="p-5">
            <div className="mb-4">
              <h2 className="text-base font-bold text-workspace-ink">افراد در حال کار</h2>
              <p className="mt-0.5 text-xs text-workspace-ink-muted">نمای سریع از کار فعال اعضای تیم.</p>
            </div>
            {data.activeWorkers.length === 0 ? (
              <p className="text-sm text-workspace-ink-muted">در حال حاضر کار فعالی ثبت نشده است.</p>
            ) : (
              <ul className="space-y-3">
                {data.activeWorkers.map((worker, index) => (
                  <li key={`${worker.user.firstName}-${worker.user.lastName}-${index}`} className="flex items-center gap-3">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-op-success" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-workspace-ink">{worker.user.firstName} {worker.user.lastName}</p>
                      <p className="mt-0.5 truncate text-xs text-workspace-ink-muted">{worker.case.title}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <Panel className="p-5">
        <div className="mb-4">
          <h2 className="text-base font-bold text-workspace-ink">فعالیت‌های اخیر</h2>
          <p className="mt-0.5 text-xs text-workspace-ink-muted">آخرین تغییرات ثبت‌شده در پرونده‌ها و جریان کار.</p>
        </div>
        <ActivityTimeline items={data.recentActivities} />
      </Panel>
    </div>
  );
}
