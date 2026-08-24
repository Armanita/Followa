'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { btnPrimary, Card, ErrorState, Field, inputClass, Spinner, Toast } from '@/components/ui';
import { faDate } from '@/lib/jalali';

interface ProfileData {
  user: {
    id: string;
    mobile: string;
    firstName: string;
    lastName: string;
    nationalId: string | null;
    birthDate: string | null;
    phone: string | null;
    address: string | null;
    maritalStatus: 'SINGLE' | 'MARRIED' | null;
    bankCardNumber: string | null;
    bankIban: string | null;
    bankName: string | null;
  };
  company: { id: string; name: string } | null;
  role?: string;
  jobTitle?: string | null;
  employeeCode?: string | null;
}

const MARITAL_LABELS = { SINGLE: 'مجرد', MARRIED: 'متأهل' } as const;

export default function ProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [form, setForm] = useState<Partial<ProfileData['user']>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const showToast = (message: string, tone: 'success' | 'error') => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    api
      .get<ProfileData>('/profile')
      .then((res) => {
        setData(res);
        setForm(res.user);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'خطا'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorState message={error} />;

  const set = (key: keyof ProfileData['user']) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        firstName: form.firstName,
        lastName: form.lastName,
        nationalId: form.nationalId || null,
        birthDate: form.birthDate ? new Date(form.birthDate).toISOString() : null,
        phone: form.phone || null,
        address: form.address || null,
        maritalStatus: form.maritalStatus || null,
        bankCardNumber: form.bankCardNumber || null,
        bankIban: form.bankIban || null,
        bankName: form.bankName || null,
      };
      const res = await api.patch<{ message: string }>('/profile', payload);
      showToast(res.message, 'success');
      const refreshed = await api.get<ProfileData>('/profile');
      setData(refreshed);
      setForm(refreshed.user);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'خطا', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.message} tone={toast.tone} />}
      <div>
        <h1 className="text-xl font-extrabold">پروفایل</h1>
        <p className="mt-0.5 text-sm text-slate-500">اطلاعات فردی و بانکی شما</p>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-xl font-black text-brand-700">
            {data.user.firstName.charAt(0)}
          </div>
          <div>
            <p className="font-bold">{data.user.firstName} {data.user.lastName}</p>
            <p className="tnum mt-0.5 text-sm text-slate-400" dir="ltr">{data.user.mobile}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              {data.role === 'COMPANY_MANAGER' ? 'مدیر شرکت' : 'کارمند'}
              {data.jobTitle && ` · ${data.jobTitle}`}
              {data.company && ` · ${data.company.name}`}
              {data.employeeCode && ` · کد پرسنلی ${data.employeeCode}`}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 font-bold">اطلاعات فردی</h2>
        <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="نام">
            <input className={inputClass} value={form.firstName ?? ''} onChange={set('firstName')} />
          </Field>
          <Field label="نام خانوادگی">
            <input className={inputClass} value={form.lastName ?? ''} onChange={set('lastName')} />
          </Field>
          <Field label="کد ملی (۱۰ رقم)">
            <input className={`${inputClass} tnum`} dir="ltr" inputMode="numeric" maxLength={10} value={form.nationalId ?? ''} onChange={set('nationalId')} />
          </Field>
          <Field label="تاریخ تولد (میلادی)">
            <input type="date" dir="ltr" className={inputClass} value={form.birthDate ? form.birthDate.slice(0, 10) : ''} onChange={set('birthDate')} />
          </Field>
          <Field label="تلفن ثابت">
            <input className={`${inputClass} tnum`} dir="ltr" value={form.phone ?? ''} onChange={set('phone')} />
          </Field>
          <Field label="وضعیت تأهل">
            <select className={inputClass} value={form.maritalStatus ?? ''} onChange={set('maritalStatus')}>
              <option value="">— انتخاب —</option>
              <option value="SINGLE">{MARITAL_LABELS.SINGLE}</option>
              <option value="MARRIED">{MARITAL_LABELS.MARRIED}</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="آدرس">
              <textarea className={`${inputClass} min-h-20`} value={form.address ?? ''} onChange={set('address')} />
            </Field>
          </div>

          <div className="sm:col-span-2 border-t border-slate-100 pt-4">
            <h3 className="mb-3 text-sm font-bold">اطلاعات بانکی</h3>
          </div>
          <Field label="شماره کارت">
            <input className={`${inputClass} tnum`} dir="ltr" inputMode="numeric" value={form.bankCardNumber ?? ''} onChange={set('bankCardNumber')} />
          </Field>
          <Field label="شماره شبا">
            <input className={`${inputClass} tnum`} dir="ltr" placeholder="IR..." value={form.bankIban ?? ''} onChange={set('bankIban')} />
          </Field>
          <Field label="نام بانک">
            <input className={inputClass} value={form.bankName ?? ''} onChange={set('bankName')} placeholder="مثلاً: بانک ملت" />
          </Field>

          <div className="flex justify-end sm:col-span-2">
            <button disabled={busy} className={`${btnPrimary.replace('w-full', '')} sm:w-auto`}>
              {busy ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
