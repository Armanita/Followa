'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { btnPrimary, btnSecondary, Card, EmptyState, ErrorState, Field, inputClass, Modal, Spinner, useConfirm, useToast } from '@/components/ui';
import { CustomersIcon, PlusIcon, SearchIcon } from '@/components/workspace/icons';
import { Avatar, PageHeader, Toolbar } from '@/components/workspace/page';
import { faDateTime, toFa } from '@/lib/jalali';
import { CASE_STATUS_LABELS } from '@/lib/labels';

interface Customer {
  id: string; type: 'INDIVIDUAL' | 'LEGAL'; name: string; mobile: string | null; phone: string | null;
  nationalId?: string | null; economicCode?: string | null; email?: string | null; address?: string | null; notes?: string | null;
  isActive: boolean; archivedAt: string | null; createdAt: string; updatedAt: string;
}
interface CustomerHistory {
  customer: Customer; summary: { totalCases: number; openCases: number; doneCases: number };
  items: { id: string; number: number; title: string; status: string; priority: string; result: string | null; resultAt: string | null; createdAt: string; currentOwner: { id: string; firstName: string; lastName: string } | null }[];
}

export default function CustomersPage() {
  const toast = useToast(); const confirm = useConfirm();
  const [items, setItems] = useState<Customer[]>([]); const [total, setTotal] = useState(0); const [search, setSearch] = useState(''); const [showArchived, setShowArchived] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [createOpen, setCreateOpen] = useState(false); const [editCustomer, setEditCustomer] = useState<Customer | null>(null); const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const params = new URLSearchParams({ pageSize: '100' }); if (search.trim()) params.set('search', search.trim()); if (showArchived) params.set('active', 'all'); const result = await api.get<{ items: Customer[]; total: number }>(`/customers?${params}`); setItems(result.items); setTotal(result.total); }
    catch (err) { setError(err instanceof Error ? err.message : 'خطا در دریافت مشتریان'); }
    finally { setLoading(false); }
  }, [search, showArchived]);
  useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => clearTimeout(timer); }, [load]);

  const toggleArchive = async (customer: Customer) => {
    const action = customer.isActive ? 'بایگانی' : 'بازیابی';
    const ok = await confirm({ title: `${action} مشتری`, message: customer.isActive ? 'پرونده‌های قبلی حفظ می‌شوند، اما تا زمان بازیابی نمی‌توان پرونده جدیدی به این مشتری متصل کرد.' : 'مشتری دوباره برای اتصال به پرونده جدید فعال خواهد شد.', confirmLabel: action });
    if (!ok) return;
    try { await api.post(`/customers/${customer.id}/${customer.isActive ? 'archive' : 'restore'}`); toast.success(customer.isActive ? 'مشتری بایگانی شد' : 'مشتری فعال شد'); await load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'خطا'); }
  };

  const activeCount = items.filter((item) => item.isActive).length;
  const archivedCount = items.filter((item) => !item.isActive).length;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="داده و ارتباطات" title="مشتریان" description="اشخاص حقیقی و حقوقی، اطلاعات تماس و سابقه پرونده‌های مرتبط را از یک محل مدیریت کنید." icon={<CustomersIcon className="h-5 w-5" />} meta={<span className="tnum">{toFa(total)} مشتری ثبت‌شده</span>} actions={<button onClick={() => setCreateOpen(true)} className={btnPrimary.replace('w-full', '')}><PlusIcon className="h-4 w-4" />مشتری جدید</button>} />

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4"><p className="text-[10px] text-workspace-soft">نتیجه فعلی</p><p className="tnum mt-2 text-2xl font-black text-white">{toFa(items.length)}</p></Card>
        <Card className="p-4"><p className="text-[10px] text-workspace-soft">فعال</p><p className="tnum mt-2 text-2xl font-black text-emerald-300">{toFa(activeCount)}</p></Card>
        <Card className="p-4"><p className="text-[10px] text-workspace-soft">بایگانی‌شده</p><p className="tnum mt-2 text-2xl font-black text-amber-300">{toFa(archivedCount)}</p></Card>
      </div>

      <Toolbar>
        <label className="relative min-w-[240px] flex-1 sm:max-w-md"><SearchIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-workspace-soft" /><input className={`${inputClass} pr-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جستجو بر اساس نام، تلفن یا شناسه…" /></label>
        <label className="flex min-h-10 items-center gap-2 rounded-xl border border-workspace-borderStrong bg-workspace-elevated px-3.5 text-xs font-semibold text-workspace-muted"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} className="accent-brand-500" />نمایش بایگانی‌شده‌ها</label>
      </Toolbar>

      {loading ? <Spinner /> : error ? <ErrorState message={error} onRetry={load} /> : items.length === 0 ? <Card><EmptyState title="مشتری‌ای یافت نشد" hint="مشتری جدید ثبت کنید یا عبارت جستجو را تغییر دهید." action={<button onClick={() => setCreateOpen(true)} className="mt-3 text-xs font-bold text-brand-300 hover:text-brand-200">ثبت اولین مشتری ←</button>} /></Card> : (
        <div className="grid gap-3 xl:grid-cols-2">
          {items.map((customer) => (
            <Card key={customer.id} className={`relative overflow-hidden p-4 ${customer.isActive ? '' : 'opacity-70'}`}>
              <span className={`absolute inset-y-4 right-0 w-0.5 rounded-full ${customer.isActive ? 'bg-brand-400' : 'bg-amber-400'}`} />
              <div className="flex items-start gap-3">
                <Avatar name={customer.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-sm font-black text-white">{customer.name}</h2><span className="rounded-full border border-workspace-borderStrong bg-workspace-elevated px-2.5 py-1 text-[10px] font-semibold text-workspace-muted">{customer.type === 'LEGAL' ? 'حقوقی' : 'حقیقی'}</span>{!customer.isActive && <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold text-amber-300">بایگانی</span>}</div>
                  <div className="mt-2 grid gap-1 text-[10px] text-workspace-soft sm:grid-cols-2">{customer.mobile && <span className="tnum" dir="ltr">{customer.mobile}</span>}{customer.phone && <span className="tnum" dir="ltr">{customer.phone}</span>}{customer.email && <span className="truncate" dir="ltr">{customer.email}</span>}<span>ثبت: {faDateTime(customer.createdAt)}</span></div>
                </div>
              </div>
              {(customer.address || customer.notes) && <div className="mt-3 rounded-xl border border-workspace-border bg-workspace-elevated/45 px-3 py-2.5 text-[10px] leading-5 text-workspace-muted">{customer.address || customer.notes}</div>}
              <div className="mt-4 flex flex-wrap gap-2 border-t border-workspace-border pt-3"><button onClick={() => setHistoryCustomer(customer)} className={btnSecondary}>تاریخچه پرونده‌ها</button><button onClick={() => setEditCustomer(customer)} className={btnSecondary}>ویرایش</button><button onClick={() => void toggleArchive(customer)} className={`${btnSecondary} ${customer.isActive ? '!border-amber-400/20 !text-amber-300' : '!border-emerald-400/20 !text-emerald-300'}`}>{customer.isActive ? 'بایگانی' : 'بازیابی'}</button></div>
            </Card>
          ))}
        </div>
      )}

      <CustomerFormModal open={createOpen} customer={null} onClose={() => setCreateOpen(false)} onDone={async () => { setCreateOpen(false); await load(); }} />
      <CustomerFormModal open={Boolean(editCustomer)} customer={editCustomer} onClose={() => setEditCustomer(null)} onDone={async () => { setEditCustomer(null); await load(); }} />
      <CustomerHistoryModal customer={historyCustomer} onClose={() => setHistoryCustomer(null)} />
    </div>
  );
}

function CustomerFormModal({ open, customer, onClose, onDone }: { open: boolean; customer: Customer | null; onClose: () => void; onDone: () => Promise<void> }) {
  const toast = useToast(); const [type, setType] = useState<'INDIVIDUAL' | 'LEGAL'>('INDIVIDUAL'); const [name, setName] = useState(''); const [mobile, setMobile] = useState(''); const [phone, setPhone] = useState(''); const [nationalId, setNationalId] = useState(''); const [economicCode, setEconomicCode] = useState(''); const [email, setEmail] = useState(''); const [address, setAddress] = useState(''); const [notes, setNotes] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!open) return; setType(customer?.type ?? 'INDIVIDUAL'); setName(customer?.name ?? ''); setMobile(customer?.mobile ?? ''); setPhone(customer?.phone ?? ''); setNationalId(customer?.nationalId ?? ''); setEconomicCode(customer?.economicCode ?? ''); setEmail(customer?.email ?? ''); setAddress(customer?.address ?? ''); setNotes(customer?.notes ?? ''); }, [open, customer]);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); const payload = { type, name: name.trim(), mobile: mobile.trim() || null, phone: phone.trim() || null, nationalId: nationalId.trim() || null, economicCode: economicCode.trim() || null, email: email.trim() || null, address: address.trim() || null, notes: notes.trim() || null }; try { if (customer) { await api.patch(`/customers/${customer.id}`, payload); toast.success('اطلاعات مشتری به‌روزرسانی شد'); } else { await api.post('/customers', payload); toast.success('مشتری ثبت شد'); } await onDone(); } catch (err) { toast.error(err instanceof Error ? err.message : 'خطا در ذخیره مشتری'); } finally { setBusy(false); } };
  return <Modal open={open} onClose={onClose} title={customer ? 'ویرایش مشتری' : 'مشتری جدید'} wide><form onSubmit={submit} className="space-y-4"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="نوع" required><select className={inputClass} value={type} onChange={(event) => setType(event.target.value as 'INDIVIDUAL' | 'LEGAL')}><option value="INDIVIDUAL">شخص حقیقی</option><option value="LEGAL">شخص حقوقی</option></select></Field><Field label="نام" required><input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label="موبایل"><input className={inputClass} value={mobile} onChange={(event) => setMobile(event.target.value)} dir="ltr" /></Field><Field label="تلفن"><input className={inputClass} value={phone} onChange={(event) => setPhone(event.target.value)} dir="ltr" /></Field><Field label={type === 'LEGAL' ? 'شناسه ملی' : 'کد ملی'}><input className={inputClass} value={nationalId} onChange={(event) => setNationalId(event.target.value)} dir="ltr" /></Field><Field label="کد اقتصادی"><input className={inputClass} value={economicCode} onChange={(event) => setEconomicCode(event.target.value)} dir="ltr" /></Field><Field label="ایمیل"><input type="email" className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} dir="ltr" /></Field></div><Field label="آدرس"><textarea className={`${inputClass} min-h-20`} value={address} onChange={(event) => setAddress(event.target.value)} /></Field><Field label="یادداشت داخلی"><textarea className={`${inputClass} min-h-20`} value={notes} onChange={(event) => setNotes(event.target.value)} /></Field><div className="flex gap-3"><button type="submit" disabled={busy || name.trim().length < 2} className={btnPrimary}>{busy ? 'در حال ذخیره…' : 'ذخیره'}</button><button type="button" onClick={onClose} className={btnSecondary}>انصراف</button></div></form></Modal>;
}

function CustomerHistoryModal({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const [data, setData] = useState<CustomerHistory | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (!customer) { setData(null); setError(''); return; } setLoading(true); setError(''); api.get<CustomerHistory>(`/customers/${customer.id}/history`).then(setData).catch((err) => setError(err instanceof Error ? err.message : 'خطا در دریافت تاریخچه')).finally(() => setLoading(false)); }, [customer]);
  return <Modal open={Boolean(customer)} onClose={onClose} title={customer ? `تاریخچه ${customer.name}` : 'تاریخچه'} wide>{loading ? <Spinner /> : error ? <ErrorState message={error} /> : data ? <div className="space-y-4"><div className="grid grid-cols-3 gap-3"><Metric label="کل پرونده‌ها" value={data.summary.totalCases} /><Metric label="باز" value={data.summary.openCases} /><Metric label="تکمیل‌شده" value={data.summary.doneCases} /></div>{data.items.length === 0 ? <EmptyState title="هنوز پرونده‌ای برای این مشتری ثبت نشده است" /> : <div className="max-h-[55vh] space-y-2 overflow-auto pl-1">{data.items.map((item) => <Link key={item.id} href={`/cases/${item.id}`} onClick={onClose} className="block rounded-xl border border-workspace-border bg-workspace-elevated/50 p-3 transition hover:border-brand-400/25 hover:bg-workspace-hover"><div className="flex flex-wrap items-center gap-2"><span className="tnum text-[10px] font-black text-workspace-soft">#{toFa(item.number)}</span><span className="flex-1 text-xs font-bold text-workspace-ink">{item.title}</span><span className="text-[10px] text-workspace-muted">{CASE_STATUS_LABELS[item.status] ?? item.status}</span></div><div className="mt-1.5 flex flex-wrap gap-3 text-[10px] text-workspace-soft"><span>ایجاد: {faDateTime(item.createdAt)}</span>{item.currentOwner && <span>مسئول: {item.currentOwner.firstName} {item.currentOwner.lastName}</span>}</div></Link>)}</div>}</div> : null}</Modal>;
}
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-workspace-border bg-workspace-elevated/60 p-3 text-center"><p className="tnum text-lg font-black text-white">{toFa(value)}</p><p className="mt-1 text-[10px] text-workspace-soft">{label}</p></div>; }
