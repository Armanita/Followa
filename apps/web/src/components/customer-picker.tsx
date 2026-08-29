'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { btnSecondary, Field, inputClass, useToast } from '@/components/ui';

interface CustomerOption {
  id: string;
  type: 'INDIVIDUAL' | 'LEGAL';
  name: string;
  mobile: string | null;
  phone: string | null;
}

export function CustomerPicker({ open }: { open: boolean }) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<CustomerOption[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickType, setQuickType] = useState<'INDIVIDUAL' | 'LEGAL'>('INDIVIDUAL');
  const [quickName, setQuickName] = useState('');
  const [quickMobile, setQuickMobile] = useState('');
  const [quickBusy, setQuickBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setItems([]);
      setSelectedId('');
      setQuickOpen(false);
      setQuickName('');
      setQuickMobile('');
      return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ pageSize: '20' });
      if (search.trim()) params.set('search', search.trim());
      api
        .get<{ items: CustomerOption[] }>(`/customers?${params}`)
        .then((result) => setItems(result.items))
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [open, search]);

  const quickCreate = async () => {
    if (quickName.trim().length < 2 || quickBusy) return;
    setQuickBusy(true);
    try {
      const result = await api.post<{ customer: CustomerOption }>('/customers', {
        type: quickType,
        name: quickName.trim(),
        mobile: quickMobile.trim() || undefined,
      });
      setItems((current) => [result.customer, ...current.filter((item) => item.id !== result.customer.id)]);
      setSelectedId(result.customer.id);
      setQuickOpen(false);
      setQuickName('');
      setQuickMobile('');
      toast.success('مشتری ثبت و انتخاب شد');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ثبت مشتری');
    } finally {
      setQuickBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-workspace-border bg-workspace-elevated/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-workspace-ink">مشتری (اختیاری)</p>
          <p className="mt-0.5 text-xs text-workspace-soft">برای پرونده‌های داخلی می‌توانید خالی بگذارید.</p>
        </div>
        <button type="button" onClick={() => setQuickOpen((value) => !value)} className={btnSecondary}>
          {quickOpen ? 'بستن' : '＋ مشتری سریع'}
        </button>
      </div>

      <Field label="جستجوی مشتری">
        <input
          className={inputClass}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="نام، موبایل یا تلفن…"
        />
      </Field>
      <div className="mt-2">
        <select
          name="customerId"
          className={inputClass}
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          <option value="">— بدون مشتری / پرونده داخلی —</option>
          {items.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
              {customer.mobile ? ` — ${customer.mobile}` : customer.phone ? ` — ${customer.phone}` : ''}
            </option>
          ))}
        </select>
        {loading && <p className="mt-1 text-xs text-workspace-soft">در حال جستجو…</p>}
      </div>

      {quickOpen && (
        <div className="mt-4 space-y-3 border-t border-workspace-border pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="نوع مشتری" required>
              <select
                className={inputClass}
                value={quickType}
                onChange={(event) => setQuickType(event.target.value as 'INDIVIDUAL' | 'LEGAL')}
              >
                <option value="INDIVIDUAL">شخص حقیقی</option>
                <option value="LEGAL">شخص حقوقی</option>
              </select>
            </Field>
            <Field label="نام مشتری" required>
              <input
                className={inputClass}
                value={quickName}
                onChange={(event) => setQuickName(event.target.value)}
                placeholder={quickType === 'LEGAL' ? 'نام شرکت / مجموعه' : 'نام و نام خانوادگی'}
              />
            </Field>
          </div>
          <Field label="موبایل (اختیاری)">
            <input
              className={inputClass}
              value={quickMobile}
              onChange={(event) => setQuickMobile(event.target.value)}
              dir="ltr"
              placeholder="0912…"
            />
          </Field>
          <button
            type="button"
            disabled={quickBusy || quickName.trim().length < 2}
            onClick={quickCreate}
            className={btnSecondary}
          >
            {quickBusy ? 'در حال ثبت…' : 'ثبت و انتخاب مشتری'}
          </button>
        </div>
      )}
    </div>
  );
}
