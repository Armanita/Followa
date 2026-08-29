import Link from 'next/link';
import { Card, EmptyState, PriorityBadge, StatusBadge } from '@/components/ui';
import { ActivityTimeline, CaseStatusChart } from '@/components/timeline';
import { faDate, isLate, toFa } from '@/lib/jalali';
import {
  ActivityIcon,
  AlertIcon,
  ArrowLeftIcon,
  CasesIcon,
  CheckIcon,
  ClockIcon,
  EmployeesIcon,
} from '@/components/workspace/icons';

type DashboardData = {
  cards: {
    totalCases: number;
    openCases: number;
    waitingAcceptance: number;
    inProgress: number;
    doneCases: number;
    cancelled: number;
    lateCases: number;
    activeEmployees: number;
  };
  urgentCases: Array<{
    id: string;
    number: number;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    currentOwner?: { id: string; firstName: string; lastName: string } | null;
    caseType?: { name: string; color: string | null } | null;
  }>;
  recentActivities: any[];
  statusChart: Array<{ status: string; count: number }>;
};

const metricTone = {
  purple: {
    border: 'border-brand-400/20',
    icon: 'border-brand-400/20 bg-brand-400/10 text-brand-200',
    glow: 'from-brand-500/20',
  },
  blue: {
    border: 'border-blue-400/20',
    icon: 'border-blue-400/20 bg-blue-400/10 text-blue-300',
    glow: 'from-blue-500/15',
  },
  amber: {
    border: 'border-amber-400/20',
    icon: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
    glow: 'from-amber-500/15',
  },
  red: {
    border: 'border-red-400/20',
    icon: 'border-red-400/20 bg-red-400/10 text-red-300',
    glow: 'from-red-500/15',
  },
  green: {
    border: 'border-emerald-400/20',
    icon: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
    glow: 'from-emerald-500/15',
  },
} as const;

type MetricTone = keyof typeof metricTone;

function MetricCard({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: number;
  hint: string;
  tone: MetricTone;
  icon: React.ReactNode;
}) {
  const styles = metricTone[tone];
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-workspace-surface p-4 shadow-card ${styles.border}`}>
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b ${styles.glow} to-transparent opacity-70`} />
      <div className="relative flex items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${styles.icon}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-workspace-muted">{label}</p>
          <p className="tnum mt-1 text-[26px] font-black tracking-tight text-white">{toFa(value)}</p>
          <p className="mt-1 truncate text-[10px] text-workspace-soft">{hint}</p>
        </div>
      </div>
    </div>
  );
}

export function ManagerDashboard({ data, firstName }: { data: DashboardData; firstName: string }) {
  const total = data.cards.totalCases || 0;
  const doneRate = total > 0 ? Math.round((data.cards.doneCases / total) * 100) : 0;
  const lateRate = total > 0 ? Math.round((data.cards.lateCases / total) * 100) : 0;
  const activeFlow = data.cards.openCases + data.cards.inProgress + data.cards.waitingAcceptance;
  const today = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 border-b border-workspace-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold text-workspace-soft">
            <span>مرکز مدیریت</span>
            <span className="h-1 w-1 rounded-full bg-workspace-borderStrong" />
            <span>{today}</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white sm:text-[30px]">سلام، {firstName || 'مدیر'}</h1>
          <p className="mt-2 max-w-2xl text-xs leading-6 text-workspace-muted">
            وضعیت پرونده‌ها، موارد نیازمند توجه و جریان جاری تیم را از یک نمای عملیاتی بررسی کنید.
          </p>
        </div>
        <Link href="/cases" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-xs font-bold text-white shadow-[0_12px_28px_rgba(109,54,237,.24)] transition hover:bg-brand-500">
          مشاهده پرونده‌ها
          <ArrowLeftIcon className="h-4 w-4" />
        </Link>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard label="کل پرونده‌ها" value={data.cards.totalCases} hint={`${toFa(activeFlow)} پرونده در جریان`} tone="purple" icon={<CasesIcon className="h-5 w-5" />} />
        <MetricCard label="در حال انجام" value={data.cards.inProgress} hint="مسئول فعال دارد" tone="blue" icon={<ActivityIcon className="h-5 w-5" />} />
        <MetricCard label="انتظار پذیرش" value={data.cards.waitingAcceptance} hint="نیازمند واکنش کارمند" tone="amber" icon={<ClockIcon className="h-5 w-5" />} />
        <MetricCard label="عقب‌افتاده" value={data.cards.lateCases} hint={`${toFa(lateRate)}٪ از کل پرونده‌ها`} tone="red" icon={<AlertIcon className="h-5 w-5" />} />
        <div className="col-span-2 lg:col-span-1">
          <MetricCard label="کارکنان فعال" value={data.cards.activeEmployees} hint="عضویت فعال در شرکت" tone="green" icon={<EmployeesIcon className="h-5 w-5" />} />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,.75fr)]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-workspace-border px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg border border-red-400/15 bg-red-400/5 text-red-300"><AlertIcon className="h-4 w-4" /></span>
                <h2 className="text-sm font-black text-white">پرونده‌های نیازمند توجه</h2>
              </div>
              <p className="mt-1 pr-10 text-[10px] text-workspace-soft">پرونده‌های با اولویت بالا یا فوری که هنوز در جریان هستند</p>
            </div>
            <Link href="/cases" className="shrink-0 text-[11px] font-bold text-brand-300 transition hover:text-brand-200">مشاهده همه</Link>
          </div>
          {data.urgentCases.length === 0 ? (
            <EmptyState title="مورد فوری وجود ندارد" hint="در حال حاضر پرونده با اولویت بالا در جریان نیست." />
          ) : (
            <div className="divide-y divide-workspace-border">
              {data.urgentCases.map((item) => {
                const late = isLate(item.dueDate, item.status);
                return (
                  <Link key={item.id} href={`/cases/${item.id}`} className="group grid gap-3 px-5 py-4 transition hover:bg-workspace-hover/65 md:grid-cols-[minmax(0,1.6fr)_minmax(135px,.65fr)_auto] md:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="tnum rounded-lg border border-workspace-border bg-workspace-elevated px-2 py-1 text-[10px] font-black text-workspace-muted">#{toFa(item.number)}</span>
                        <PriorityBadge priority={item.priority} />
                        <StatusBadge status={item.status} />
                      </div>
                      <p className="mt-2 truncate text-[13px] font-bold text-workspace-ink transition group-hover:text-brand-200">{item.title}</p>
                      <p className="mt-1 text-[10px] text-workspace-soft">{item.caseType?.name ? `نوع: ${item.caseType.name}` : 'بدون نوع ثبت‌شده'}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-workspace-soft">مسئول فعلی</p>
                      <p className="mt-1 truncate text-xs font-semibold text-workspace-muted">{item.currentOwner ? `${item.currentOwner.firstName} ${item.currentOwner.lastName}` : 'در انتظار پذیرش'}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] text-workspace-soft">سررسید</p>
                      <p className={`tnum mt-1 text-xs font-bold ${late ? 'text-red-300' : 'text-workspace-muted'}`}>{item.dueDate ? faDate(item.dueDate) : '—'}</p>
                      {late && <p className="mt-1 text-[9px] font-semibold text-red-400">عبور از سررسید</p>}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-white">سلامت جریان پرونده‌ها</h2>
              <p className="mt-1 text-[10px] text-workspace-soft">توزیع وضعیت بر اساس داده جاری</p>
            </div>
            <span className="tnum rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-black text-emerald-300">{toFa(doneRate)}٪ تکمیل</span>
          </div>
          <CaseStatusChart data={data.statusChart} />
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-workspace-border pt-4">
            <div className="rounded-xl border border-workspace-border bg-workspace-elevated/60 p-3">
              <p className="text-[10px] text-workspace-soft">تکمیل‌شده</p>
              <p className="tnum mt-1 text-lg font-black text-emerald-300">{toFa(data.cards.doneCases)}</p>
            </div>
            <div className="rounded-xl border border-workspace-border bg-workspace-elevated/60 p-3">
              <p className="text-[10px] text-workspace-soft">لغوشده</p>
              <p className="tnum mt-1 text-lg font-black text-workspace-muted">{toFa(data.cards.cancelled)}</p>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.55fr)]">
        <Card className="p-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-black text-white">فعالیت‌های اخیر</h2>
              <p className="mt-1 text-[10px] text-workspace-soft">آخرین تغییرات ثبت‌شده روی پرونده‌های شرکت</p>
            </div>
            <ActivityIcon className="h-5 w-5 text-workspace-soft" />
          </div>
          <ActivityTimeline items={data.recentActivities} />
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-brand-400/20 bg-brand-400/10 text-brand-200"><CheckIcon className="h-5 w-5" /></span>
            <div>
              <h2 className="text-sm font-black text-white">تصویر عملیاتی</h2>
              <p className="mt-1 text-[10px] text-workspace-soft">خلاصه قابل اقدام از وضعیت فعلی</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-workspace-border bg-workspace-elevated/60 px-3.5 py-3"><span className="text-[11px] text-workspace-muted">پرونده‌های باز</span><strong className="tnum text-sm text-white">{toFa(data.cards.openCases)}</strong></div>
            <div className="flex items-center justify-between rounded-xl border border-workspace-border bg-workspace-elevated/60 px-3.5 py-3"><span className="text-[11px] text-workspace-muted">در جریان فعال</span><strong className="tnum text-sm text-indigo-300">{toFa(data.cards.inProgress)}</strong></div>
            <div className="flex items-center justify-between rounded-xl border border-workspace-border bg-workspace-elevated/60 px-3.5 py-3"><span className="text-[11px] text-workspace-muted">نیازمند پذیرش</span><strong className="tnum text-sm text-amber-300">{toFa(data.cards.waitingAcceptance)}</strong></div>
            <div className="flex items-center justify-between rounded-xl border border-red-400/15 bg-red-400/5 px-3.5 py-3"><span className="text-[11px] text-red-200">عقب‌افتاده</span><strong className="tnum text-sm text-red-300">{toFa(data.cards.lateCases)}</strong></div>
          </div>
        </Card>
      </section>
    </div>
  );
}
