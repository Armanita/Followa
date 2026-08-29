'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { CustomerPicker } from '@/components/customer-picker';
import {
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
  btnPrimary,
  useToast,
} from '@/components/ui';
import { CasesIcon, PlusIcon, SearchIcon } from '@/components/workspace/icons';
import { PageHeader, Toolbar } from '@/components/workspace/page';
import { faDate, isLate, toFa } from '@/lib/jalali';
import { CASE_STATUS_LABELS } from '@/lib/labels';

interface CaseRow {
  id: string;
  number: number;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  createdAt: string;
  currentOwner?: { id: string; firstName: string; lastName: string } | null;
  createdBy?: { id: string; firstName: string; lastName: string };
  caseType?: { name: string; color: string | null } | null;
  customer?: { id: string; type: 'INDIVIDUAL' | 'LEGAL'; name: string; isActive: boolean } | null;
}

function CasesPageInner() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<CaseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [mine, setMine] = useState(searchParams.get('mine') === 'true');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      if (mine) params.set('mine', 'true');
      params.set('page', String(page));
      params.set('pageSize', '15');
      const res = await api.get<{ items: CaseRow[]; total: number }>(`/cases?${params}`);
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setLoading(false);
    }
  }, [search, status, mine, page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="مرکز عملیات"
        title={mine ? 'کارهای من' : 'پرونده‌ها'}
        description={mine ? 'پرونده‌هایی که در حال حاضر در مسئولیت یا جریان کاری شما هستند.' : 'فهرست عملیاتی پرونده‌های شرکت با وضعیت، مسئول، مشتری و سررسید.'}
        meta={<span className="tnum">{toFa(total)} پرونده در نتیجه فعلی</span>}
        icon={<CasesIcon className="h-5 w-5" />}
        actions={
          <button onClick={() => setCreateOpen(true)} className={btnPrimary.replace('w-full', '')}>
            <PlusIcon className="h-4 w-4" />
            پرونده جدید
          </button>
        }
      />

      <Toolbar>
        <label className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <SearchIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-workspace-soft" />
          <input
            className={`${inputClass} pr-9`}
            placeholder="جستجو در عنوان پرونده…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <select
          className={`${inputClass} sm:w-52`}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">همه وضعیت‌ها</option>
          {Object.entries(CASE_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <label className="flex min-h-10 items-center gap-2 rounded-xl border border-workspace-borderStrong bg-workspace-elevated px-3.5 text-xs font-semibold text-workspace-muted">
          <input
            type="checkbox"
            checked={mine}
            onChange={(e) => {
              setMine(e.target.checked);
              setPage(1);
            }}
            className="accent-brand-500"
          />
          فقط مسئولیت من
        </label>
      </Toolbar>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState title="پرونده‌ای یافت نشد" hint="فیلترها را تغییر دهید یا پرونده جدیدی ثبت کنید." action={<button onClick={() => setCreateOpen(true)} className="mt-3 text-xs font-bold text-brand-300 hover:text-brand-200">ساخت اولین پرونده ←</button>} />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[90px_minmax(220px,1.8fr)_minmax(130px,.8fr)_minmax(130px,.8fr)_110px] gap-3 border-b border-workspace-border bg-workspace-elevated/45 px-5 py-3 text-[10px] font-semibold text-workspace-soft lg:grid">
            <span>شناسه</span><span>پرونده</span><span>مسئول / مشتری</span><span>وضعیت</span><span>سررسید</span>
          </div>
          <div className="divide-y divide-workspace-border">
            {items.map((item) => {
              const late = isLate(item.dueDate, item.status);
              return (
                <Link key={item.id} href={`/cases/${item.id}`} className="group grid gap-3 px-4 py-4 transition hover:bg-workspace-hover/60 lg:grid-cols-[90px_minmax(220px,1.8fr)_minmax(130px,.8fr)_minmax(130px,.8fr)_110px] lg:items-center lg:px-5">
                  <div className="flex items-center gap-2 lg:block">
                    <span className="tnum inline-flex rounded-lg border border-workspace-border bg-workspace-elevated px-2 py-1 text-[10px] font-black text-workspace-muted">#{toFa(item.number)}</span>
                    <span className="lg:mt-2 lg:block"><PriorityBadge priority={item.priority} /></span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-workspace-ink transition group-hover:text-brand-200">{item.title}</p>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-workspace-soft">
                      {item.caseType && <span>نوع: {item.caseType.name}</span>}
                      <span>ایجاد: {faDate(item.createdAt)}</span>
                    </div>
                  </div>
                  <div className="min-w-0 text-[11px]">
                    <p className="truncate font-semibold text-workspace-muted">{item.currentOwner ? `${item.currentOwner.firstName} ${item.currentOwner.lastName}` : 'در انتظار پذیرش'}</p>
                    {item.customer && <p className={`mt-1 truncate text-[10px] ${item.customer.isActive ? 'text-workspace-soft' : 'text-amber-300'}`}>{item.customer.name}{item.customer.isActive ? '' : ' · بایگانی'}</p>}
                  </div>
                  <div><StatusBadge status={item.status} /></div>
                  <div className="text-left lg:text-right">
                    <p className={`tnum text-[11px] font-semibold ${late ? 'text-red-300' : 'text-workspace-muted'}`}>{item.dueDate ? faDate(item.dueDate) : '—'}</p>
                    {late && <p className="mt-1 text-[9px] text-red-400">عقب‌افتاده</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      {total > 15 && (
        <div className="flex items-center justify-center gap-3 pt-1 text-xs">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className={btnSecondary}>قبلی</button>
          <span className="tnum rounded-lg border border-workspace-border bg-workspace-surface px-3 py-2 text-workspace-muted">صفحه {toFa(page)}</span>
          <button disabled={page * 15 >= total} onClick={() => setPage((p) => p + 1)} className={btnSecondary}>بعدی</button>
        </div>
      )}

      <CreateCaseModalImpl open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); void load(); }} />
    </div>
  );
}

function CreateCaseModalImpl({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const meId = typeof window === 'undefined' ? '' : safeUserId();
  const isManager = typeof window === 'undefined' ? false : safeIsManager();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [caseTypeId, setCaseTypeId] = useState('');
  const [assignTo, setAssignTo] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [members, setMembers] = useState<{ userId: string; fullName: string; role: string }[]>([]);
  const [caseTypes, setCaseTypes] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get<{ caseTypes: { id: string; name: string }[] }>('/companies/current').then((r) => setCaseTypes(r.caseTypes)).catch(() => {});
    api.get<{ items: { userId: string; fullName: string; isActive: boolean; role: string }[] }>('/members').then((r) => setMembers(r.items.filter((m) => m.isActive))).catch(() => {});
  }, [open]);

  const eligibleAssignees = isManager ? members.filter((m) => m.userId !== meId && m.role !== 'COMPANY_MANAGER') : members;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const customerId = String(formData.get('customerId') ?? '');
    setLoading(true);
    try {
      await api.post('/cases', { title, description: description || undefined, priority, caseTypeId: caseTypeId || undefined, customerId: customerId || undefined, assignToUserId: assignTo || undefined, assignNote: assignNote || undefined });
      toast.success('پرونده ساخته شد');
      setTitle(''); setDescription(''); setAssignTo(''); setAssignNote('');
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ایجاد پرونده');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="پرونده جدید" wide>
      <form onSubmit={submit} className="space-y-4">
        <Field label="عنوان" required><input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً: تماس با مشتری برای پیش‌فاکتور" autoFocus /></Field>
        <Field label="توضیحات"><textarea className={`${inputClass} min-h-24`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="شرح موضوع، انتظارات و مراحل…" /></Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="نوع پرونده"><select className={inputClass} value={caseTypeId} onChange={(e) => setCaseTypeId(e.target.value)}><option value="">— بدون نوع —</option>{caseTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></Field>
          <Field label="اولویت"><select className={inputClass} value={priority} onChange={(e) => setPriority(e.target.value)}><option value="LOW">کم</option><option value="NORMAL">معمولی</option><option value="HIGH">زیاد</option><option value="URGENT">فوری</option></select></Field>
        </div>
        <CustomerPicker open={open} />
        <div className="rounded-2xl border border-workspace-border bg-workspace-elevated/60 p-4">
          <p className="mb-3 text-xs font-bold text-workspace-ink">ارجاع اولیه <span className="font-normal text-workspace-soft">· اختیاری</span></p>
          <Field label="ارجاع به"><select className={inputClass} value={assignTo} onChange={(e) => setAssignTo(e.target.value)}><option value="">{isManager ? 'بدون ارجاع — فقط ثبت پرونده' : 'خودم پیگیری می‌کنم'}</option>{eligibleAssignees.map((member) => <option key={member.userId} value={member.userId}>{member.fullName}</option>)}</select></Field>
          {assignTo && <div className="mt-3"><Field label="توضیح ارجاع"><textarea className={`${inputClass} min-h-16`} value={assignNote} onChange={(e) => setAssignNote(e.target.value)} /></Field></div>}
        </div>
        <div className="flex gap-3"><button type="submit" disabled={loading || title.length < 3} className={btnPrimary}>{loading ? 'در حال ثبت…' : 'ایجاد پرونده'}</button><button type="button" onClick={onClose} className={btnSecondary}>انصراف</button></div>
      </form>
    </Modal>
  );
}

function safeUserId(): string { try { return JSON.parse(localStorage.getItem('followa_user') ?? '{}').id ?? ''; } catch { return ''; } }
function safeIsManager(): boolean { try { return JSON.parse(localStorage.getItem('followa_user') ?? '{}').role === 'COMPANY_MANAGER'; } catch { return false; } }

export default function CasesPage() { return <Suspense fallback={<Spinner />}><CasesPageInner /></Suspense>; }
