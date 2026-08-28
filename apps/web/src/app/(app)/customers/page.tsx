'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  btnPrimary,
  btnSecondary,
  Card,
  EmptyState,
  ErrorState,
  Field,
  inputClass,
  Modal,
  Spinner,
  useConfirm,
  useToast,
} from '@/components/ui';
import { faDateTime, toFa } from '@/lib/jalali';
import { CASE_STATUS_LABELS } from '@/lib/labels';

interface Customer {
  id: string;
  type: 'INDIVIDUAL' | 'LEGAL';
  name: string;
  mobile: string | null;
  phone: string | null;
  nationalId?: string | null;
  economicCode?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  isActive: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CustomerHistory {
  customer: Customer;
  summary: { totalCases: number; openCases: number; doneCases: number };
  items: {
    id: string;
    number: number;
    title: string;
    status: string;
    priority: string;
    result: string | null;
    resultAt: string | null;
    createdAt: string;
    currentOwner: { id: string; firstName: string; lastName: string } | null;
  }[];
}

export default function CustomersPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ pageSize: '100' });
      if (search.trim()) params.set('search', search.trim());
      if (showArchived) params.set('active', 'all');
      const result = await api.get<{ items: Customer[]; total: number }>(`/customers?${params}`);
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در دریافت مشتریان');
    } finally {
      setLoading(false);
    }
  }, [search, showArchived]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  const toggleArchive = async (customer: Customer) => {
    const action = customer.isActive ? 'بایگانی' : 'بازیابی';
    const ok = await confirm({
      title: `${action} مشتری`,
      message: customer.isActive
        ? 'پرونده‌های قبلی مشتری حفظ می‌شوند، اما تا زمان بازیابی نمی‌توان پرونده جدیدی به او متصل کرد.'
        : 'مشتری دوباره در انتخاب پرونده جدید فعال خواهد شد.',
      confirmLabel: action,
    });
    if (!ok) return;
    try {
      await api.post(`/customers/${customer.id}/${customer.isActive ? 'archive' : 'restore'}`);
      toast.success(customer.isActive ? 'مشتری بایگانی شد' : 'مشتری فعال شد');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">مشتریان</h1>
          <p className="tnum mt-0.5 text-sm text-slate-500">{toFa(total)} مشتری</p>
        </div>
        <button onClick={() => setCreateOpen(true)} className={btnPrimary.replace('w-full', '')}>
          ＋ مشتری جدید
        </button>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <input
          className={`${inputClass} sm:max-w-sm`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="جستجو بر اساس نام، تلفن یا شناسه…"
        />
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
            className="accent-brand-600"
          />
          نمایش بایگانی‌شده‌ها
        </label>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          title="مشتری‌ای یافت نشد"
          hint="مشتری جدید بسازید یا عبارت جستجو را تغییر دهید."
          action={
            <button onClick={() => setCreateOpen(true)} className="mt-3 text-sm font-semibold text-brand-600 hover:underline">
              ثبت اولین مشتری ←
            </button>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {items.map((customer) => (
            <Card key={customer.id} className={`p-4 ${customer.isActive ? '' : 'opacity-70'}`}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                      {customer.type === 'LEGAL' ? 'حقوقی' : 'حقیقی'}
                    </span>
                    {!customer.isActive && (
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                        بایگانی‌شده
                      </span>
                    )}
                    <h2 className="font-bold text-slate-800">{customer.name}</h2>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {customer.mobile && <span className="tnum">موبایل: {customer.mobile}</span>}
                    {customer.phone && <span className="tnum">تلفن: {customer.phone}</span>}
                    {customer.email && <span dir="ltr">{customer.email}</span>}
                    <span>ثبت: {faDateTime(customer.createdAt)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setHistoryCustomer(customer)} className={btnSecondary}>
                    تاریخچه پرونده‌ها
                  </button>
                  <button onClick={() => setEditCustomer(customer)} className={btnSecondary}>
                    ویرایش
                  </button>
                  <button
                    onClick={() => void toggleArchive(customer)}
                    className={`${btnSecondary} ${customer.isActive ? '!text-amber-700' : '!text-emerald-700'}`}
                  >
                    {customer.isActive ? 'بایگانی' : 'بازیابی'}
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CustomerFormModal
        open={createOpen}
        customer={null}
        onClose={() => setCreateOpen(false)}
        onDone={async () => {
          setCreateOpen(false);
          await load();
        }}
      />
      <CustomerFormModal
        open={Boolean(editCustomer)}
        customer={editCustomer}
        onClose={() => setEditCustomer(null)}
        onDone={async () => {
          setEditCustomer(null);
          await load();
        }}
      />
      <CustomerHistoryModal customer={historyCustomer} onClose={() => setHistoryCustomer(null)} />
    </div>
  );
}

function CustomerFormModal({
  open,
  customer,
  onClose,
  onDone,
}: {
  open: boolean;
  customer: Customer | null;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const [type, setType] = useState<'INDIVIDUAL' | 'LEGAL'>('INDIVIDUAL');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [phone, setPhone] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [economicCode, setEconomicCode] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType(customer?.type ?? 'INDIVIDUAL');
    setName(customer?.name ?? '');
    setMobile(customer?.mobile ?? '');
    setPhone(customer?.phone ?? '');
    setNationalId(customer?.nationalId ?? '');
    setEconomicCode(customer?.economicCode ?? '');
    setEmail(customer?.email ?? '');
    setAddress(customer?.address ?? '');
    setNotes(customer?.notes ?? '');
  }, [open, customer]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const payload = {
      type,
      name: name.trim(),
      mobile: mobile.trim() || null,
      phone: phone.trim() || null,
      nationalId: nationalId.trim() || null,
      economicCode: economicCode.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
    };
    try {
      if (customer) {
        await api.patch(`/customers/${customer.id}`, payload);
        toast.success('اطلاعات مشتری به‌روزرسانی شد');
      } else {
        await api.post('/customers', payload);
        toast.success('مشتری ثبت شد');
      }
      await onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ذخیره مشتری');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={customer ? 'ویرایش مشتری' : 'مشتری جدید'} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="نوع" required>
            <select className={inputClass} value={type} onChange={(event) => setType(event.target.value as 'INDIVIDUAL' | 'LEGAL')}>
              <option value="INDIVIDUAL">شخص حقیقی</option>
              <option value="LEGAL">شخص حقوقی</option>
            </select>
          </Field>
          <Field label="نام" required>
            <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="موبایل">
            <input className={inputClass} value={mobile} onChange={(event) => setMobile(event.target.value)} dir="ltr" />
          </Field>
          <Field label="تلفن">
            <input className={inputClass} value={phone} onChange={(event) => setPhone(event.target.value)} dir="ltr" />
          </Field>
          <Field label={type === 'LEGAL' ? 'شناسه ملی' : 'کد ملی'}>
            <input className={inputClass} value={nationalId} onChange={(event) => setNationalId(event.target.value)} dir="ltr" />
          </Field>
          <Field label="کد اقتصادی">
            <input className={inputClass} value={economicCode} onChange={(event) => setEconomicCode(event.target.value)} dir="ltr" />
          </Field>
          <Field label="ایمیل">
            <input type="email" className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} dir="ltr" />
          </Field>
        </div>
        <Field label="آدرس">
          <textarea className={`${inputClass} min-h-20`} value={address} onChange={(event) => setAddress(event.target.value)} />
        </Field>
        <Field label="یادداشت داخلی">
          <textarea className={`${inputClass} min-h-20`} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        <div className="flex gap-3">
          <button type="submit" disabled={busy || name.trim().length < 2} className={btnPrimary}>
            {busy ? 'در حال ذخیره…' : 'ذخیره'}
          </button>
          <button type="button" onClick={onClose} className={btnSecondary}>انصراف</button>
        </div>
      </form>
    </Modal>
  );
}

function CustomerHistoryModal({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const [data, setData] = useState<CustomerHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!customer) {
      setData(null);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    api
      .get<CustomerHistory>(`/customers/${customer.id}/history`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'خطا در دریافت تاریخچه'))
      .finally(() => setLoading(false));
  }, [customer]);

  return (
    <Modal open={Boolean(customer)} onClose={onClose} title={customer ? `تاریخچه ${customer.name}` : 'تاریخچه'} wide>
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} />
      ) : data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Metric label="کل پرونده‌ها" value={data.summary.totalCases} />
            <Metric label="باز" value={data.summary.openCases} />
            <Metric label="تکمیل‌شده" value={data.summary.doneCases} />
          </div>
          {data.items.length === 0 ? (
            <EmptyState title="هنوز پرونده‌ای برای این مشتری ثبت نشده است" />
          ) : (
            <div className="max-h-[55vh] space-y-2 overflow-auto pl-1">
              {data.items.map((item) => (
                <Link
                  key={item.id}
                  href={`/cases/${item.id}`}
                  onClick={onClose}
                  className="block rounded-xl border border-slate-200 p-3 transition hover:border-brand-300 hover:bg-brand-50/30"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tnum text-xs font-bold text-slate-400">#{toFa(item.number)}</span>
                    <span className="flex-1 text-sm font-semibold text-slate-800">{item.title}</span>
                    <span className="text-xs text-slate-500">{CASE_STATUS_LABELS[item.status] ?? item.status}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-400">
                    <span>ایجاد: {faDateTime(item.createdAt)}</span>
                    {item.currentOwner && <span>مسئول: {item.currentOwner.firstName} {item.currentOwner.lastName}</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center ring-1 ring-slate-100">
      <p className="tnum text-lg font-extrabold text-slate-800">{toFa(value)}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </div>
  );
}
