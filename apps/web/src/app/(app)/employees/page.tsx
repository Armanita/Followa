'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  btnPrimary,
  Card,
  EmptyState,
  ErrorState,
  Field,
  inputClass,
  Modal,
  Spinner,
  Toast,
} from '@/components/ui';
import { faDate, toFa } from '@/lib/jalali';

interface MemberRow {
  membershipId: string;
  userId: string;
  fullName: string;
  mobile: string;
  role: 'COMPANY_MANAGER' | 'EMPLOYEE';
  isActive: boolean;
  hasPassword: boolean;
  jobTitle: string | null;
  employeeCode: string | null;
  createdAt: string;
}

export default function EmployeesPage() {
  const [items, setItems] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<MemberRow | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const showToast = (message: string, tone: 'success' | 'error') => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    try {
      setError('');
      const res = await api.get<{ items: MemberRow[] }>('/members');
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleActive = async (m: MemberRow) => {
    try {
      await api.patch(`/members/${m.membershipId}`, { isActive: !m.isActive });
      showToast(m.isActive ? `${m.fullName} غیرفعال شد` : `${m.fullName} فعال شد`, 'success');
      void load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'خطا', 'error');
    }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.message} tone={toast.tone} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">کارکنان</h1>
          <p className="tnum mt-0.5 text-sm text-slate-500">{toFa(items.length)} عضو</p>
        </div>
        <button onClick={() => setCreateOpen(true)} className={btnPrimary.replace('w-full', '')}>
          ＋ افزودن کارمند
        </button>
      </div>

      {items.length === 0 ? (
        <Card>
          <EmptyState title="هنوز عضوی ثبت نشده" hint="اولین کارمند را اضافه کنید." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-right text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-xs text-slate-500">
                  <th className="px-4 py-3 font-semibold">نام</th>
                  <th className="px-4 py-3 font-semibold">موبایل</th>
                  <th className="px-4 py-3 font-semibold">سمت</th>
                  <th className="px-4 py-3 font-semibold">وضعیت</th>
                  <th className="px-4 py-3 font-semibold">عضویت از</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((m) => (
                  <tr key={m.membershipId} className="transition hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{m.fullName}</p>
                      {m.jobTitle && <p className="text-xs text-slate-400">{m.jobTitle}</p>}
                    </td>
                    <td className="tnum px-4 py-3" dir="ltr">{m.mobile}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                          m.role === 'COMPANY_MANAGER'
                            ? 'bg-violet-50 text-violet-700 ring-violet-200'
                            : 'bg-slate-50 text-slate-600 ring-slate-200'
                        }`}
                      >
                        {m.role === 'COMPANY_MANAGER' ? 'مدیر' : 'کارمند'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                          m.isActive
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                            : 'bg-red-50 text-red-600 ring-red-200'
                        }`}
                      >
                        {m.isActive ? 'فعال' : 'غیرفعال'}
                      </span>
                      {!m.hasPassword && (
                        <span className="mr-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                          رمز تعیین نشده
                        </span>
                      )}
                    </td>
                    <td className="tnum px-4 py-3 text-xs text-slate-400">{faDate(m.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setResetTarget(m)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          بازنشانی رمز
                        </button>
                        <button
                          onClick={() => toggleActive(m)}
                          disabled={m.role === 'COMPANY_MANAGER' && m.membershipId === myMembership()}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                            m.isActive
                              ? 'border-red-200 text-red-600 hover:bg-red-50'
                              : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {m.isActive ? 'تعلیق' : 'فعال‌سازی'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <CreateEmployeeModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} showToast={showToast} />
      <ResetPasswordModal target={resetTarget} onClose={() => setResetTarget(null)} showToast={showToast} />
    </div>
  );
}

function myMembership(): string {
  if (typeof window === 'undefined') return '';
  // membership id isn't in cached user; manager self-disable is blocked server-side anyway
  return '';
}

function CreateEmployeeModal({
  open,
  onClose,
  onCreated,
  showToast,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  showToast: (m: string, t: 'success' | 'error') => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [role, setRole] = useState('EMPLOYEE');
  const [jobTitle, setJobTitle] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <Modal open={open} onClose={onClose} title="افزودن کارمند">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const res = await api.post<{ message: string; requiresOtpSignup: boolean }>('/members', {
              firstName,
              lastName,
              mobile,
              role,
              jobTitle: jobTitle || undefined,
              password: password || undefined,
            });
            showToast(res.message, 'success');
            setFirstName('');
            setLastName('');
            setMobile('');
            setPassword('');
            onClose();
            onCreated();
          } catch (err) {
            showToast(err instanceof Error ? err.message : 'خطا', 'error');
          } finally {
            setBusy(false);
          }
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="نام" required>
            <input className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
          </Field>
          <Field label="نام خانوادگی" required>
            <input className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </Field>
        </div>
        <Field label="شماره موبایل" required>
          <input className={`${inputClass} tnum text-left`} dir="ltr" inputMode="numeric" placeholder="09123456789" value={mobile} onChange={(e) => setMobile(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="نقش">
            <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="EMPLOYEE">کارمند</option>
              <option value="COMPANY_MANAGER">مدیر</option>
            </select>
          </Field>
          <Field label="سمت سازمانی">
            <input className={inputClass} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="کارشناس فروش" />
          </Field>
        </div>
        <Field label="رمز عبور اولیه (اختیاری)">
          <input type="password" dir="ltr" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="خالی = ثبت‌نام با کد یکبارمصرف" />
        </Field>
        <p className="text-xs text-slate-400">
          اگر رمز نخواهید، کارمند با شماره موبایل و کد یکبارمصرف رمز خود را می‌سازد.
        </p>
        <button disabled={busy || !firstName || !lastName || mobile.length < 10} className={btnPrimary}>افزودن</button>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({
  target,
  onClose,
  showToast,
}: {
  target: MemberRow | null;
  onClose: () => void;
  showToast: (m: string, t: 'success' | 'error') => void;
}) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={Boolean(target)} onClose={onClose} title="بازنشانی رمز عبور">
      {target && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api.post(`/members/${target.membershipId}/reset-password`, { newPassword: password });
              showToast(`رمز ${target.fullName} بازنشانی شد`, 'success');
              setPassword('');
              onClose();
            } catch (err) {
              showToast(err instanceof Error ? err.message : 'خطا', 'error');
            } finally {
              setBusy(false);
            }
          }}
          className="space-y-4"
        >
          <p className="text-sm text-slate-500">رمز جدید برای «{target.fullName}» تنظیم می‌شود.</p>
          <Field label="رمز عبور جدید" required>
            <input type="password" dir="ltr" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          </Field>
          <button disabled={busy || password.length < 8} className={btnPrimary}>بازنشانی</button>
        </form>
      )}
    </Modal>
  );
}
