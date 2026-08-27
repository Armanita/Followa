'use client';

import { useEffect, useState } from 'react';
import { api, getFileObjectUrl } from '@/lib/api';
import { btnPrimary, Field, inputClass, Modal, Spinner, useToast } from '@/components/ui';
import { faDate, faDateInput, jalaliDateToIso } from '@/lib/jalali';

export interface PersonnelTarget {
  membershipId: string;
  fullName: string;
}

interface PersonnelProfileResponse {
  user: {
    id: string;
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
  membership: {
    id: string;
    role: 'COMPANY_MANAGER' | 'EMPLOYEE';
    isActive: boolean;
    jobTitle: string | null;
    employeeCode: string | null;
  };
  company: { id: string; name: string };
}

type FormState = Pick<
  PersonnelProfileResponse['user'],
  | 'firstName'
  | 'lastName'
  | 'nationalId'
  | 'phone'
  | 'address'
  | 'maritalStatus'
  | 'bankCardNumber'
  | 'bankIban'
  | 'bankName'
>;

export function PersonnelProfileModal({
  target,
  onClose,
  onUpdated,
}: {
  target: PersonnelTarget | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const toast = useToast();
  const [data, setData] = useState<PersonnelProfileResponse | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [birthDate, setBirthDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  useEffect(() => {
    if (!target) {
      setData(null);
      setForm(null);
      setBirthDate('');
      setPhotoUrl(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    api
      .get<PersonnelProfileResponse>(`/members/${target.membershipId}/profile`)
      .then(async (res) => {
        if (cancelled) return;
        setData(res);
        setForm({
          firstName: res.user.firstName,
          lastName: res.user.lastName,
          nationalId: res.user.nationalId,
          phone: res.user.phone,
          address: res.user.address,
          maritalStatus: res.user.maritalStatus,
          bankCardNumber: res.user.bankCardNumber,
          bankIban: res.user.bankIban,
          bankName: res.user.bankName,
        });
        setBirthDate(res.user.birthDate ? faDateInput(res.user.birthDate) : '');
        if (res.user.hasPersonnelPhoto) {
          try {
            const photo = await getFileObjectUrl(`/members/${target.membershipId}/photo`);
            if (!cancelled) setPhotoUrl(photo.url);
            else URL.revokeObjectURL(photo.url);
          } catch {
            if (!cancelled) setPhotoUrl(null);
          }
        } else {
          setPhotoUrl(null);
        }
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'خطا در دریافت اطلاعات پرسنلی'))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [target, toast]);

  const set = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((current) => (current ? { ...current, [key]: e.target.value || null } : current));

  const refreshPhoto = async () => {
    if (!target) return;
    const photo = await getFileObjectUrl(`/members/${target.membershipId}/photo`);
    setPhotoUrl(photo.url);
  };

  const uploadPhoto = async (file: File) => {
    if (!target) return;
    setPhotoBusy(true);
    try {
      const body = new FormData();
      body.append('file', file);
      await api.post(`/members/${target.membershipId}/photo`, body);
      await refreshPhoto();
      setData((current) =>
        current ? { ...current, user: { ...current.user, hasPersonnelPhoto: true } } : current,
      );
      toast.success('عکس پرسنلی به‌روزرسانی شد');
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در بارگذاری عکس');
    } finally {
      setPhotoBusy(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target || !form) return;
    setBusy(true);
    try {
      const payload = {
        ...form,
        birthDate: birthDate.trim() ? jalaliDateToIso(birthDate) : null,
      };
      const res = await api.patch<{ message: string }>(`/members/${target.membershipId}/profile`, payload);
      toast.success(res.message);
      onUpdated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ذخیره اطلاعات پرسنلی');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={Boolean(target)} onClose={onClose} title={target ? `اطلاعات پرسنلی — ${target.fullName}` : 'اطلاعات پرسنلی'}>
      {loading || !data || !form ? (
        <Spinner />
      ) : (
        <form onSubmit={save} className="space-y-4">
          <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white text-xl font-black text-brand-700 ring-1 ring-slate-200">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="عکس پرسنلی" className="h-full w-full object-cover" />
              ) : (
                data.user.firstName.charAt(0)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">عکس پرسنلی</p>
              <p className="mt-1 text-xs text-slate-500">JPG، PNG یا WebP تا ۵ مگابایت</p>
              <label className="mt-2 inline-flex cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                {photoBusy ? 'در حال بارگذاری…' : data.user.hasPersonnelPhoto ? 'تعویض عکس' : 'افزودن عکس'}
                <input
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={photoBusy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadPhoto(file);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
            </div>
          </div>

          {data.user.profileFinalizedAt && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              اطلاعات توسط کارمند در {faDate(data.user.profileFinalizedAt)} ثبت نهایی شده است؛ ویرایش مدیریتی همچنان مجاز است.
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="نام" required>
              <input className={inputClass} value={form.firstName} onChange={set('firstName')} />
            </Field>
            <Field label="نام خانوادگی" required>
              <input className={inputClass} value={form.lastName} onChange={set('lastName')} />
            </Field>
            <Field label="کد ملی">
              <input className={`${inputClass} tnum`} dir="ltr" inputMode="numeric" maxLength={10} value={form.nationalId ?? ''} onChange={set('nationalId')} />
            </Field>
            <Field label="تاریخ تولد شمسی">
              <input className={`${inputClass} tnum`} dir="ltr" placeholder="۱۴۰۵/۰۶/۰۷" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </Field>
            <Field label="تلفن">
              <input className={`${inputClass} tnum`} dir="ltr" value={form.phone ?? ''} onChange={set('phone')} />
            </Field>
            <Field label="وضعیت تأهل">
              <select className={inputClass} value={form.maritalStatus ?? ''} onChange={set('maritalStatus')}>
                <option value="">— انتخاب —</option>
                <option value="SINGLE">مجرد</option>
                <option value="MARRIED">متأهل</option>
              </select>
            </Field>
          </div>
          <Field label="آدرس">
            <textarea className={`${inputClass} min-h-20`} value={form.address ?? ''} onChange={set('address')} />
          </Field>
          <div className="border-t border-slate-100 pt-4">
            <p className="mb-3 text-sm font-bold">اطلاعات بانکی</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="شماره کارت">
                <input className={`${inputClass} tnum`} dir="ltr" inputMode="numeric" value={form.bankCardNumber ?? ''} onChange={set('bankCardNumber')} />
              </Field>
              <Field label="شماره شبا">
                <input className={`${inputClass} tnum`} dir="ltr" placeholder="IR..." value={form.bankIban ?? ''} onChange={set('bankIban')} />
              </Field>
              <Field label="نام بانک">
                <input className={inputClass} value={form.bankName ?? ''} onChange={set('bankName')} />
              </Field>
            </div>
          </div>
          <button disabled={busy} className={btnPrimary}>
            {busy ? 'در حال ذخیره…' : 'ذخیره تغییرات پرسنلی'}
          </button>
        </form>
      )}
    </Modal>
  );
}
