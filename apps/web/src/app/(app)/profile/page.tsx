'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, getFileObjectUrl } from '@/lib/api';
import {
  btnPrimary,
  Card,
  ErrorState,
  Field,
  inputClass,
  Spinner,
  useConfirm,
  useToast,
} from '@/components/ui';
import { faDate, faDateInput, jalaliDateToIso } from '@/lib/jalali';

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
    profileFinalizedAt: string | null;
    hasPersonnelPhoto: boolean;
  };
  company: { id: string; name: string } | null;
  role?: 'COMPANY_MANAGER' | 'EMPLOYEE';
  jobTitle?: string | null;
  employeeCode?: string | null;
}

const MARITAL_LABELS = { SINGLE: 'مجرد', MARRIED: 'متأهل' } as const;

export default function ProfilePage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<ProfileData | null>(null);
  const [form, setForm] = useState<Partial<ProfileData['user']>>({});
  const [birthDate, setBirthDate] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  const loadPhoto = useCallback(async (hasPhoto: boolean) => {
    if (!hasPhoto) {
      setPhotoUrl(null);
      return;
    }
    try {
      const photo = await getFileObjectUrl('/profile/photo');
      setPhotoUrl(photo.url);
    } catch {
      setPhotoUrl(null);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setError('');
      const res = await api.get<ProfileData>('/profile');
      setData(res);
      setForm(res.user);
      setBirthDate(res.user.birthDate ? faDateInput(res.user.birthDate) : '');
      await loadPhoto(res.user.hasPersonnelPhoto);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setLoading(false);
    }
  }, [loadPhoto]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorState message={error} onRetry={load} />;

  const locked = data.role === 'EMPLOYEE' && Boolean(data.user.profileFinalizedAt);

  const set = (key: keyof ProfileData['user']) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const payload = () => ({
    firstName: form.firstName,
    lastName: form.lastName,
    nationalId: form.nationalId || null,
    birthDate: birthDate.trim() ? jalaliDateToIso(birthDate) : null,
    phone: form.phone || null,
    address: form.address || null,
    maritalStatus: form.maritalStatus || null,
    bankCardNumber: form.bankCardNumber || null,
    bankIban: form.bankIban || null,
    bankName: form.bankName || null,
  });

  const saveDraft = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (locked) return;
    setBusy(true);
    try {
      const res = await api.patch<{ message: string }>('/profile', payload());
      toast.success(res.message);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const finalize = async () => {
    if (locked || data.role !== 'EMPLOYEE') return;
    const ok = await confirm({
      title: 'ثبت نهایی اطلاعات پرسنلی؟',
      message: 'پس از ثبت نهایی دیگر نمی‌توانید اطلاعات یا عکس پرسنلی را ویرایش کنید و هر تغییر بعدی فقط توسط مدیر شرکت انجام می‌شود.',
      confirmLabel: 'ثبت نهایی',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.patch('/profile', payload());
      const res = await api.post<{ message: string }>('/profile/finalize');
      toast.success(res.message);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ثبت نهایی اطلاعات');
    } finally {
      setBusy(false);
    }
  };

  const uploadPhoto = async (file: File) => {
    if (locked) return;
    setPhotoBusy(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await api.post<{ message: string }>('/profile/photo', body);
      toast.success(res.message);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در بارگذاری عکس');
    } finally {
      setPhotoBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold">پروفایل</h1>
        <p className="mt-0.5 text-sm text-slate-500">اطلاعات فردی و بانکی شما</p>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-brand-50 text-xl font-black text-brand-700 ring-1 ring-brand-100">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="عکس پرسنلی" className="h-full w-full object-cover" />
            ) : (
              data.user.firstName.charAt(0)
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold">{data.user.firstName} {data.user.lastName}</p>
            <p className="tnum mt-0.5 text-sm text-slate-400" dir="ltr">{data.user.mobile}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              {data.role === 'COMPANY_MANAGER' ? 'مدیر شرکت' : 'کارمند'}
              {data.jobTitle && ` · ${data.jobTitle}`}
              {data.company && ` · ${data.company.name}`}
              {data.employeeCode && ` · کد پرسنلی ${data.employeeCode}`}
            </p>
            {!locked && (
              <label className="mt-3 inline-flex cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                {photoBusy ? 'در حال بارگذاری…' : data.user.hasPersonnelPhoto ? 'تعویض عکس پرسنلی' : 'افزودن عکس پرسنلی'}
                <input
                  className="hidden"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={photoBusy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadPhoto(file);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
            )}
            <p className="mt-1 text-[11px] text-slate-400">JPG، PNG یا WebP تا ۵ مگابایت</p>
          </div>
        </div>
      </Card>

      {locked && data.user.profileFinalizedAt && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-bold">اطلاعات پرسنلی ثبت نهایی شده است</p>
          <p className="mt-1 text-xs leading-6 text-emerald-800">
            ثبت نهایی در {faDate(data.user.profileFinalizedAt)} انجام شده است. برای هر تغییر بعدی با مدیر شرکت هماهنگ کنید.
          </p>
        </div>
      )}

      <Card className="p-5">
        <h2 className="mb-4 font-bold">اطلاعات فردی</h2>
        <form onSubmit={saveDraft} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="نام">
            <input disabled={locked} className={inputClass} value={form.firstName ?? ''} onChange={set('firstName')} />
          </Field>
          <Field label="نام خانوادگی">
            <input disabled={locked} className={inputClass} value={form.lastName ?? ''} onChange={set('lastName')} />
          </Field>
          <Field label="کد ملی (۱۰ رقم)">
            <input disabled={locked} className={`${inputClass} tnum`} dir="ltr" inputMode="numeric" maxLength={10} value={form.nationalId ?? ''} onChange={set('nationalId')} />
          </Field>
          <Field label="تاریخ تولد شمسی">
            <input disabled={locked} className={`${inputClass} tnum`} dir="ltr" placeholder="۱۴۰۵/۰۶/۰۷" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </Field>
          <Field label="تلفن ثابت">
            <input disabled={locked} className={`${inputClass} tnum`} dir="ltr" value={form.phone ?? ''} onChange={set('phone')} />
          </Field>
          <Field label="وضعیت تأهل">
            <select disabled={locked} className={inputClass} value={form.maritalStatus ?? ''} onChange={set('maritalStatus')}>
              <option value="">— انتخاب —</option>
              <option value="SINGLE">{MARITAL_LABELS.SINGLE}</option>
              <option value="MARRIED">{MARITAL_LABELS.MARRIED}</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="آدرس">
              <textarea disabled={locked} className={`${inputClass} min-h-20`} value={form.address ?? ''} onChange={set('address')} />
            </Field>
          </div>

          <div className="sm:col-span-2 border-t border-slate-100 pt-4">
            <h3 className="mb-3 text-sm font-bold">اطلاعات بانکی</h3>
          </div>
          <Field label="شماره کارت">
            <input disabled={locked} className={`${inputClass} tnum`} dir="ltr" inputMode="numeric" value={form.bankCardNumber ?? ''} onChange={set('bankCardNumber')} />
          </Field>
          <Field label="شماره شبا">
            <input disabled={locked} className={`${inputClass} tnum`} dir="ltr" placeholder="IR..." value={form.bankIban ?? ''} onChange={set('bankIban')} />
          </Field>
          <Field label="نام بانک">
            <input disabled={locked} className={inputClass} value={form.bankName ?? ''} onChange={set('bankName')} placeholder="مثلاً: بانک ملت" />
          </Field>

          {!locked && (
            <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
              <button type="submit" disabled={busy} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                {busy ? 'در حال ذخیره…' : 'ذخیره موقت'}
              </button>
              {data.role === 'EMPLOYEE' && (
                <button type="button" disabled={busy} onClick={() => void finalize()} className={btnPrimary.replace('w-full', '')}>
                  ثبت نهایی اطلاعات
                </button>
              )}
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}
