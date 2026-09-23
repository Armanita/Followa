'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  btnSecondary,
  Card,
  EmptyState,
  ErrorState,
  Field,
  inputClass,
  PriorityBadge,
  Spinner,
  StatusBadge,
} from '@/components/ui';
import { PanelHeader } from '@/components/workspace/page';
import { faDate, toFa } from '@/lib/jalali';

interface CustomerOption {
  id: string;
  type: 'INDIVIDUAL' | 'LEGAL';
  name: string;
  mobile: string | null;
  phone: string | null;
}

interface MemberOption {
  userId: string;
  fullName: string;
}

interface CaseTypeOption {
  id: string;
  name: string;
}

interface ReportCaseRow {
  id: string;
  number: number;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  resultAt: string | null;
  currentOwner?: { id: string; firstName: string; lastName: string } | null;
  caseType?: { id: string; name: string; color: string | null } | null;
  customer?: { id: string; name: string } | null;
}

export function CustomerCaseReport() {
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [archive, setArchive] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [caseTypeId, setCaseTypeId] = useState('');
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [caseTypes, setCaseTypes] = useState<CaseTypeOption[]>([]);
  const [items, setItems] = useState<ReportCaseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setCustomerLoading(true);
      const params = new URLSearchParams({ pageSize: '20' });
      if (search.trim()) params.set('search', search.trim());
      api
        .get<{ items: CustomerOption[] }>(`/customers?${params}`)
        .then((result) => setCustomers(result.items))
        .catch(() => setCustomers([]))
        .finally(() => setCustomerLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    api
      .get<{ caseTypes: CaseTypeOption[] }>('/companies/current')
      .then((result) => setCaseTypes(result.caseTypes))
      .catch(() => setCaseTypes([]));
    api
      .get<{ items: { userId: string; fullName: string; isActive: boolean }[] }>('/members')
      .then((result) => setMembers(result.items.filter((m) => m.isActive)))
      .catch(() => setMembers([]));
  }, []);

  const load = useCallback(async () => {
    if (!customerId) {
      setItems([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('customerId', customerId);
      if (archive) params.set('archive', archive);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (ownerId) params.set('ownerId', ownerId);
      if (caseTypeId) params.set('caseTypeId', caseTypeId);
      params.set('page', String(page));
      params.set('pageSize', '15');
      const res = await api.get<{ items: ReportCaseRow[]; total: number }>(`/cases?${params}`);
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setLoading(false);
    }
  }, [customerId, archive, from, to, ownerId, caseTypeId, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const ownerName = (owner?: ReportCaseRow['currentOwner']) =>
    owner ? `${owner.firstName} ${owner.lastName}` : '—';

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <PanelHeader
          title="فیلترهای گزارش مشتری"
          description="مشتری را انتخاب کنید؛ پرونده‌ها بر اساس وضعیت، بازه زمانی، کارمند و نوع پرونده نمایش داده می‌شوند."
        />
        <div className="space-y-4 px-5 pb-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="جستجوی مشتری">
              <input
                className={inputClass}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="نام، موبایل یا تلفن…"
              />
            </Field>
            <Field label="مشتری" required>
              <select
                className={inputClass}
                value={customerId}
                onChange={(event) => {
                  setCustomerId(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">— مشتری را انتخاب کنید —</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                    {customer.mobile ? ` — ${customer.mobile}` : customer.phone ? ` — ${customer.phone}` : ''}
                  </option>
                ))}
              </select>
              {customerLoading && <p className="mt-1 text-xs text-workspace-soft">در حال جستجو…</p>}
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="وضعیت">
              <select
                className={inputClass}
                value={archive}
                onChange={(event) => {
                  setArchive(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">همه</option>
                <option value="active">در حال انجام</option>
                <option value="archived">بایگانی شده</option>
              </select>
            </Field>
            <Field label="از تاریخ">
              <input
                type="date"
                className={inputClass}
                dir="ltr"
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value);
                  setPage(1);
                }}
              />
            </Field>
            <Field label="تا تاریخ">
              <input
                type="date"
                className={inputClass}
                dir="ltr"
                value={to}
                onChange={(event) => {
                  setTo(event.target.value);
                  setPage(1);
                }}
              />
            </Field>
            <Field label="کارمند">
              <select
                className={inputClass}
                value={ownerId}
                onChange={(event) => {
                  setOwnerId(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">همه کارمندان</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.fullName}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="نوع پرونده">
              <select
                className={inputClass}
                value={caseTypeId}
                onChange={(event) => {
                  setCaseTypeId(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">همه انواع</option>
                {caseTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </Card>

      {!customerId ? (
        <Card>
          <EmptyState
            title="مشتری را انتخاب کنید"
            hint="پس از انتخاب مشتری، پرونده‌های مرتبط به همراه وضعیت، تاریخ ایجاد و تکمیل نمایش داده می‌شوند."
          />
        </Card>
      ) : loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            title="پرونده‌ای برای این مشتری یافت نشد"
            hint="فیلترها را تغییر دهید یا بازه زمانی را گسترده‌تر کنید."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <PanelHeader
            title="پرونده‌های مشتری"
            description="خلاصه عملیاتی انتخاب‌شده؛ اعداد مستقیماً از API خوانده می‌شوند."
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-right text-xs">
              <thead>
                <tr className="border-b border-workspace-border bg-workspace-elevated/45 text-[10px] text-workspace-soft">
                  <th className="px-5 py-3 font-semibold">شناسه</th>
                  <th className="px-4 py-3 font-semibold">عنوان</th>
                  <th className="px-4 py-3 font-semibold">نوع</th>
                  <th className="px-4 py-3 font-semibold">وضعیت</th>
                  <th className="px-4 py-3 font-semibold">مسئول</th>
                  <th className="px-4 py-3 font-semibold">تاریخ ایجاد</th>
                  <th className="px-4 py-3 font-semibold">تاریخ تکمیل</th>
                  <th className="px-4 py-3 font-semibold">اولویت</th>
                  <th className="px-4 py-3 font-semibold">آخرین بروزرسانی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-workspace-border">
                {items.map((item) => (
                  <tr key={item.id} className="transition hover:bg-workspace-hover/55">
                    <td className="tnum px-5 py-3.5 font-black text-workspace-muted">#{toFa(item.number)}</td>
                    <td className="max-w-[220px] px-4 py-3.5">
                      <p className="truncate font-bold text-workspace-ink">{item.title}</p>
                    </td>
                    <td className="px-4 py-3.5 text-workspace-muted">{item.caseType?.name ?? '—'}</td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3.5 text-workspace-muted">{ownerName(item.currentOwner)}</td>
                    <td className="tnum px-4 py-3.5 text-workspace-soft">{faDate(item.createdAt)}</td>
                    <td className="tnum px-4 py-3.5 text-workspace-soft">{item.resultAt ? faDate(item.resultAt) : '—'}</td>
                    <td className="px-4 py-3.5">
                      <PriorityBadge priority={item.priority} />
                    </td>
                    <td className="tnum px-4 py-3.5 text-workspace-soft">{faDate(item.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > 15 && (
            <div className="flex items-center justify-center gap-3 border-t border-workspace-border p-4 text-xs">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className={btnSecondary}>
                قبلی
              </button>
              <span className="tnum rounded-lg border border-workspace-border bg-workspace-surface px-3 py-2 text-workspace-muted">
                صفحه {toFa(page)}
              </span>
              <button disabled={page * 15 >= total} onClick={() => setPage((p) => p + 1)} className={btnSecondary}>
                بعدی
              </button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
