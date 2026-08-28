'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { CustomerPicker } from '@/components/customer-picker';
import {
  btnSecondary,
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">{mine ? 'کارهای من' : 'پرونده‌ها'}</h1>
          <p className="tnum mt-0.5 text-sm text-slate-500">{toFa(total)} پرونده</p>
        </div>
        <button onClick={() => setCreateOpen(true)} className={btnPrimary.replace('w-full', '')}>
          ＋ پرونده جدید
        </button>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <input
          className={`${inputClass} sm:max-w-xs`}
          placeholder="جستجو در عنوان…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className={`${inputClass} sm:w-48`}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">همه وضعیت‌ها</option>
          {Object.entries(CASE_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={mine}
            onChange={(e) => {
              setMine(e.target.checked);
              setPage(1);
            }}
            className="accent-brand-600"
          />
          فقط مسئولیت من
        </label>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          title="پرونده‌ای یافت نشد"
          hint="با تغییر فیلترها یا ساخت پرونده جدید شروع کنید."
          action={
            <button onClick={() => setCreateOpen(true)} className="mt-3 text-sm font-semibold text-brand-600 hover:underline">
              ساخت اولین پرونده ←
            </button>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {items.map((c) => (
            <Link key={c.id} href={`/cases/${c.id}`} className="block">
              <div className="group rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/70 transition hover:ring-brand-300">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tnum rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
                    #{toFa(c.number)}
                  </span>
                  <PriorityBadge priority={c.priority} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold group-hover:text-brand-700">
                    {c.title}
                  </span>
                  <StatusBadge status={c.status} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                  <span>مسئول: {c.currentOwner ? `${c.currentOwner.firstName} ${c.currentOwner.lastName}` : 'در انتظار پذیرش'}</span>
                  {c.customer && (
                    <span className={c.customer.isActive ? '' : 'text-amber-600'}>
                      مشتری: {c.customer.name}{c.customer.isActive ? '' : ' (بایگانی‌شده)'}
                    </span>
                  )}
                  {c.caseType && <span>نوع: {c.caseType.name}</span>}
                  <span>ایجاد: {faDate(c.createdAt)}</span>
                  {c.dueDate && (
                    <span className={isLate(c.dueDate, c.status) ? 'font-semibold text-red-600' : ''}>
                      سررسید: {faDate(c.dueDate)}
                      {isLate(c.dueDate, c.status) && ' (عقب‌افتاده)'}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
          {total > items.length && (
            <div className="flex items-center justify-center gap-3 pt-3 text-sm">
              <button disabled={page === 1} onClick={() => setPage(page - 1)} className={btnSecondary}>
                قبلی
              </button>
              <span className="tnum text-slate-500">صفحه {toFa(page)}</span>
              <button disabled={page * 15 >= total} onClick={() => setPage(page + 1)} className={btnSecondary}>
                بعدی
              </button>
            </div>
          )}
        </div>
      )}

      <CreateCaseModalImpl
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          void load();
        }}
      />
    </div>
  );
}

function CreateCaseModalImpl({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
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
    api
      .get<{ items: { userId: string; fullName: string; isActive: boolean; role: string }[] }>('/members')
      .then((r) => setMembers(r.items.filter((m) => m.isActive)))
      .catch(() => {});
  }, [open]);

  const eligibleAssignees = isManager
    ? members.filter((m) => m.userId !== meId && m.role !== 'COMPANY_MANAGER')
    : members;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const customerId = String(formData.get('customerId') ?? '');
    setLoading(true);
    try {
      await api.post('/cases', {
        title,
        description: description || undefined,
        priority,
        caseTypeId: caseTypeId || undefined,
        customerId: customerId || undefined,
        assignToUserId: assignTo || undefined,
        assignNote: assignNote || undefined,
      });
      toast.success('پرونده ساخته شد');
      setTitle('');
      setDescription('');
      setAssignTo('');
      setAssignNote('');
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
        <Field label="عنوان" required>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً: تماس با مشتری برای پیش‌فاکتور" autoFocus />
        </Field>
        <Field label="توضیحات">
          <textarea className={`${inputClass} min-h-24`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="شرح موضوع، انتظارات و مراحل…" />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="نوع پرونده">
            <select className={inputClass} value={caseTypeId} onChange={(e) => setCaseTypeId(e.target.value)}>
              <option value="">— بدون نوع —</option>
              {caseTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
          <Field label="اولویت">
            <select className={inputClass} value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="LOW">کم</option>
              <option value="NORMAL">معمولی</option>
              <option value="HIGH">زیاد</option>
              <option value="URGENT">فوری</option>
            </select>
          </Field>
        </div>

        <CustomerPicker open={open} />

        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
          <p className="mb-3 text-sm font-semibold text-slate-700">ارجاع به کارمند (اختیاری)</p>
          <Field label="ارجاع به">
            <select className={inputClass} value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
              <option value="">
                {isManager ? 'بدون ارجاع — فقط ثبت پرونده' : 'خودم پیگیری می‌کنم'}
              </option>
              {eligibleAssignees.map((m) => (
                <option key={m.userId} value={m.userId}>{m.fullName}</option>
              ))}
            </select>
          </Field>
          {assignTo && (
            <div className="mt-3">
              <Field label="توضیح ارجاع">
                <textarea className={`${inputClass} min-h-16`} value={assignNote} onChange={(e) => setAssignNote(e.target.value)} />
              </Field>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading || title.length < 3} className={btnPrimary}>
            {loading ? 'در حال ثبت…' : 'ایجاد پرونده'}
          </button>
          <button type="button" onClick={onClose} className={btnSecondary}>انصراف</button>
        </div>
      </form>
    </Modal>
  );
}

function safeUserId(): string {
  try {
    return JSON.parse(localStorage.getItem('followa_user') ?? '{}').id ?? '';
  } catch {
    return '';
  }
}

function safeIsManager(): boolean {
  try {
    return JSON.parse(localStorage.getItem('followa_user') ?? '{}').role === 'COMPANY_MANAGER';
  } catch {
    return false;
  }
}

export default function CasesPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <CasesPageInner />
    </Suspense>
  );
}
