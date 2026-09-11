'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import {
  btnPrimary,
  btnSecondary,
  Card,
  ConfirmProvider,
  EmptyState,
  ErrorState,
  Field,
  inputClass,
  Modal,
  Spinner,
  StatCard,
  ToastProvider,
  useConfirm,
  useToast,
} from '@/components/ui';
import { DashboardIcon, EmployeesIcon, PlusIcon } from '@/components/workspace/icons';
import { Avatar, PageHeader, PanelHeader } from '@/components/workspace/page';
import { ApiError, api, clearAdminAuth } from '@/lib/api';
import { faDate, toFa } from '@/lib/jalali';

type AdminStats = {
  companyCount: number;
  userCount: number;
  caseCount: number;
};

type CompanyManager = {
  id: string;
  userId: string;
  membershipId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  mobile: string;
  jobTitle: string | null;
  isActive: boolean;
  telegramConnected: boolean;
  hasPassword: boolean;
};

type CompanyRow = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  managers: CompanyManager[];
  memberCount: number;
  caseCount: number;
};

type ReplaceTarget = {
  company: CompanyRow;
  manager: CompanyManager;
};

export default function AdminPage() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AdminShell>
          <AdminDashboard />
        </AdminShell>
      </ConfirmProvider>
    </ToastProvider>
  );
}

function AdminDashboard() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CompanyRow | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<ReplaceTarget | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleAdminAuthFailure = useCallback((err: unknown) => {
    if (err instanceof ApiError && (err.statusCode === 401 || err.statusCode === 403)) {
      clearAdminAuth();
      router.replace('/admin/login');
      return true;
    }
    return false;
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError('');
      const [statsRes, companiesRes] = await Promise.all([
        api.get<AdminStats>('/admin/stats'),
        api.get<{ items: CompanyRow[] }>('/admin/companies'),
      ]);
      setStats(statsRes);
      setCompanies(companiesRes.items);
    } catch (err) {
      if (!handleAdminAuthFailure(err)) {
        setError(err instanceof Error ? err.message : 'خطا در دریافت اطلاعات مدیریت سامانه');
      }
    } finally {
      setLoading(false);
    }
  }, [handleAdminAuthFailure]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleCompany = async (company: CompanyRow) => {
    if (busyId) return;
    const deactivating = company.isActive;
    const ok = await confirm({
      title: deactivating ? `غیرفعال‌سازی ${company.name}؟` : `فعال‌سازی ${company.name}؟`,
      message: deactivating
        ? 'دسترسی اعضای این شرکت تا فعال‌سازی مجدد متوقف خواهد شد.'
        : 'دسترسی شرکت و اعضای فعال آن دوباره برقرار می‌شود.',
      confirmLabel: deactivating ? 'غیرفعال‌سازی' : 'فعال‌سازی',
      danger: deactivating,
    });
    if (!ok) return;

    setBusyId(company.id);
    try {
      const res = await api.patch<{ message: string }>(`/admin/companies/${company.id}/active`, {
        isActive: !company.isActive,
      });
      toast.success(res.message);
      await load();
    } catch (err) {
      if (!handleAdminAuthFailure(err)) {
        toast.error(err instanceof Error ? err.message : 'خطا در تغییر وضعیت شرکت');
      }
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <Spinner label="در حال بارگذاری مدیریت سامانه…" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!stats) return null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="مدیریت سامانه"
        title="داشبورد مدیر سیستم"
        description="شرکت‌ها و نمای کلی سامانه فالوآ را از این بخش مدیریت کنید."
        icon={<DashboardIcon className="h-5 w-5" />}
        actions={
          <button onClick={() => setCreateOpen(true)} className={btnPrimary.replace('w-full', '')}>
            <PlusIcon className="h-4 w-4" />
            افزودن شرکت
          </button>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="تعداد شرکت‌ها" value={toFa(stats.companyCount)} />
        <StatCard label="تعداد کاربران" value={toFa(stats.userCount)} />
        <StatCard label="تعداد پرونده‌ها" value={toFa(stats.caseCount)} />
      </section>

      <Card className="overflow-hidden">
        <PanelHeader
          title="شرکت‌ها"
          description={`${toFa(companies.length)} شرکت ثبت‌شده در سامانه`}
        />

        {companies.length === 0 ? (
          <EmptyState
            title="هنوز شرکتی ثبت نشده است"
            hint="برای شروع، اولین شرکت و مدیر آن را اضافه کنید."
            action={
              <button onClick={() => setCreateOpen(true)} className={`${btnPrimary.replace('w-full', '')} mt-3`}>
                <PlusIcon className="h-4 w-4" />
                افزودن شرکت
              </button>
            }
          />
        ) : (
          <>
            <div className="divide-y divide-workspace-border md:hidden">
              {companies.map((company) => (
                <div key={company.id} className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-black text-workspace-ink">{company.name}</h3>
                        <CompanyStatusBadge active={company.isActive} />
                      </div>
                      <p className="tnum mt-1 text-[10px] text-workspace-soft">ثبت: {faDate(company.createdAt)}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditTarget(company)}
                        className="rounded-lg border border-workspace-borderStrong bg-workspace-elevated px-3 py-2 text-[10px] font-semibold text-workspace-muted transition hover:bg-workspace-hover hover:text-white"
                      >
                        ویرایش
                      </button>
                      <button
                        type="button"
                        disabled={busyId === company.id}
                        onClick={() => void toggleCompany(company)}
                        className={`rounded-lg border px-3 py-2 text-[10px] font-semibold transition disabled:opacity-50 ${
                          company.isActive
                            ? 'border-red-400/20 text-red-300 hover:bg-red-400/10'
                            : 'border-emerald-400/20 text-emerald-300 hover:bg-emerald-400/10'
                        }`}
                      >
                        {company.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-workspace-border bg-workspace-elevated/55 p-3">
                      <p className="text-[9px] text-workspace-soft">اعضا</p>
                      <p className="tnum mt-1 text-sm font-black text-white">{toFa(company.memberCount)}</p>
                    </div>
                    <div className="rounded-xl border border-workspace-border bg-workspace-elevated/55 p-3">
                      <p className="text-[9px] text-workspace-soft">پرونده‌ها</p>
                      <p className="tnum mt-1 text-sm font-black text-white">{toFa(company.caseCount)}</p>
                    </div>
                  </div>

                  {company.managers.length > 0 ? (
                    <div className="space-y-2">
                      {company.managers.map((manager) => (
                        <div key={manager.membershipId} className="rounded-xl border border-workspace-border bg-workspace-elevated/35 p-3">
                          <div className="flex items-start gap-3">
                            <Avatar name={manager.fullName} size="sm" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-bold text-workspace-ink">{manager.fullName}</p>
                              <p className="tnum mt-0.5 text-[10px] text-workspace-soft" dir="ltr">{manager.mobile}</p>
                              {manager.jobTitle && <p className="mt-0.5 text-[9px] text-workspace-soft">{manager.jobTitle}</p>}
                            </div>
                            {manager.isActive && (
                              <button
                                type="button"
                                onClick={() => setReplaceTarget({ company, manager })}
                                className="shrink-0 rounded-lg border border-amber-400/20 px-2.5 py-1.5 text-[9px] font-semibold text-amber-300 transition hover:bg-amber-400/10"
                              >
                                تعویض مدیر
                              </button>
                            )}
                          </div>
                          <ManagerBadges manager={manager} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-workspace-border bg-workspace-elevated/35 p-3 text-[10px] text-workspace-soft">
                      مدیری برای این شرکت ثبت نشده است.
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1040px] text-right text-xs">
                <thead>
                  <tr className="border-b border-workspace-border bg-workspace-elevated/45 text-[10px] text-workspace-soft">
                    <th className="px-5 py-3 font-semibold">شرکت</th>
                    <th className="px-4 py-3 font-semibold">مدیر</th>
                    <th className="px-4 py-3 font-semibold">موبایل مدیر</th>
                    <th className="px-4 py-3 font-semibold">وضعیت</th>
                    <th className="px-4 py-3 font-semibold">اعضا</th>
                    <th className="px-4 py-3 font-semibold">پرونده‌ها</th>
                    <th className="px-4 py-3 font-semibold">تاریخ ایجاد</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-workspace-border">
                  {companies.map((company) => (
                    <tr key={company.id} className="transition hover:bg-workspace-hover/55">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={company.name} />
                          <p className="font-bold text-workspace-ink">{company.name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {company.managers.length > 0 ? (
                          <div className="space-y-3">
                            {company.managers.map((manager) => (
                              <div key={manager.membershipId}>
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-workspace-muted">{manager.fullName}</p>
                                  {manager.isActive && (
                                    <button
                                      type="button"
                                      onClick={() => setReplaceTarget({ company, manager })}
                                      className="rounded-lg border border-amber-400/20 px-2 py-1 text-[9px] font-semibold text-amber-300 transition hover:bg-amber-400/10"
                                    >
                                      تعویض مدیر
                                    </button>
                                  )}
                                </div>
                                {manager.jobTitle && <p className="mt-0.5 text-[9px] text-workspace-soft">{manager.jobTitle}</p>}
                                <ManagerBadges manager={manager} />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-workspace-soft">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {company.managers.length > 0 ? (
                          <div className="space-y-3">
                            {company.managers.map((manager) => (
                              <p key={manager.membershipId} className="tnum text-workspace-muted" dir="ltr">{manager.mobile}</p>
                            ))}
                          </div>
                        ) : (
                          <span className="text-workspace-soft">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5"><CompanyStatusBadge active={company.isActive} /></td>
                      <td className="tnum px-4 py-3.5 font-bold text-workspace-muted">{toFa(company.memberCount)}</td>
                      <td className="tnum px-4 py-3.5 font-bold text-workspace-muted">{toFa(company.caseCount)}</td>
                      <td className="tnum px-4 py-3.5 text-[10px] text-workspace-soft">{faDate(company.createdAt)}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditTarget(company)}
                            className="rounded-lg border border-workspace-borderStrong bg-workspace-elevated px-3 py-2 text-[10px] font-semibold text-workspace-muted transition hover:bg-workspace-hover hover:text-white"
                          >
                            ویرایش
                          </button>
                          <button
                            type="button"
                            disabled={busyId === company.id}
                            onClick={() => void toggleCompany(company)}
                            className={`rounded-lg border px-3 py-2 text-[10px] font-semibold transition disabled:opacity-50 ${
                              company.isActive
                                ? 'border-red-400/20 text-red-300 hover:bg-red-400/10'
                                : 'border-emerald-400/20 text-emerald-300 hover:bg-emerald-400/10'
                            }`}
                          >
                            {company.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <CreateCompanyModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={load}
        onAuthFailure={handleAdminAuthFailure}
      />
      <EditCompanyModal
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={load}
        onAuthFailure={handleAdminAuthFailure}
      />
      <ReplaceManagerModal
        target={replaceTarget}
        onClose={() => setReplaceTarget(null)}
        onReplaced={load}
        onAuthFailure={handleAdminAuthFailure}
      />
    </div>
  );
}

function CompanyStatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
      active
        ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
        : 'border-red-400/20 bg-red-400/10 text-red-300'
    }`}>
      {active ? 'فعال' : 'غیرفعال'}
    </span>
  );
}

function ManagerBadges({ manager }: { manager: CompanyManager }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${manager.isActive ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-workspace-borderStrong bg-workspace-elevated text-workspace-soft'}`}>
        {manager.isActive ? 'مدیر فعال' : 'مدیر غیرفعال'}
      </span>
      <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${manager.telegramConnected ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-workspace-borderStrong bg-workspace-elevated text-workspace-soft'}`}>
        {manager.telegramConnected ? 'تلگرام متصل' : 'تلگرام متصل نیست'}
      </span>
      <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${manager.hasPassword ? 'border-brand-400/20 bg-brand-400/10 text-brand-200' : 'border-amber-400/20 bg-amber-400/10 text-amber-300'}`}>
        {manager.hasPassword ? 'حساب فعال' : 'نیاز به فعال‌سازی'}
      </span>
    </div>
  );
}

function CreateCompanyModal({
  open,
  onClose,
  onCreated,
  onAuthFailure,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
  onAuthFailure: (err: unknown) => boolean;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName('');
    setFirstName('');
    setLastName('');
    setMobile('');
    setPassword('');
    setJobTitle('');
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title="افزودن شرکت" wide>
      <form
        className="space-y-5"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          try {
            const res = await api.post<{ message: string; companyId: string }>('/admin/companies', {
              name,
              manager: {
                firstName,
                lastName,
                mobile,
                password,
                jobTitle: jobTitle || undefined,
              },
            });
            toast.success(res.message);
            reset();
            onClose();
            await onCreated();
          } catch (err) {
            if (!onAuthFailure(err)) {
              toast.error(err instanceof Error ? err.message : 'خطا در ایجاد شرکت');
            }
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="نام شرکت" required>
          <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} autoFocus />
        </Field>

        <div className="border-t border-workspace-border pt-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-brand-400/20 bg-brand-400/10 text-brand-200">
              <EmployeesIcon className="h-4 w-4" />
            </span>
            <div>
              <h4 className="text-sm font-black text-white">مدیر نخست شرکت</h4>
              <p className="mt-0.5 text-[10px] text-workspace-soft">این اطلاعات برای ایجاد عضویت مدیر شرکت استفاده می‌شود.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="نام مدیر" required>
              <input className={inputClass} value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            </Field>
            <Field label="نام خانوادگی مدیر" required>
              <input className={inputClass} value={lastName} onChange={(event) => setLastName(event.target.value)} />
            </Field>
            <Field label="شماره موبایل مدیر" required>
              <input
                className={`${inputClass} tnum text-left`}
                dir="ltr"
                inputMode="numeric"
                placeholder="09123456789"
                value={mobile}
                onChange={(event) => setMobile(event.target.value)}
              />
            </Field>
            <Field label="سمت مدیر">
              <input className={inputClass} value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="مدیر شرکت" />
            </Field>
          </div>

          <div className="mt-3">
            <Field label="رمز عبور مدیر" required>
              <input
                type="password"
                className={inputClass}
                dir="ltr"
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                placeholder="حداقل ۸ کاراکتر"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-workspace-border pt-5 sm:flex-row">
          <button type="button" onClick={close} disabled={busy} className="inline-flex flex-1 items-center justify-center rounded-xl border border-workspace-borderStrong bg-workspace-elevated px-4 py-2.5 text-sm font-semibold text-workspace-muted transition hover:bg-workspace-hover hover:text-white disabled:opacity-60">
            انصراف
          </button>
          <button
            type="submit"
            disabled={busy || name.trim().length < 2 || !firstName.trim() || !lastName.trim() || mobile.trim().length < 10 || password.length < 8}
            className={`${btnPrimary} flex-1`}
          >
            {busy ? 'در حال ایجاد…' : 'ایجاد شرکت'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditCompanyModal({
  target,
  onClose,
  onSaved,
  onAuthFailure,
}: {
  target: CompanyRow | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onAuthFailure: (err: unknown) => boolean;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const applyManager = useCallback((manager: CompanyManager | null) => {
    setSelectedUserId(manager?.userId ?? '');
    setFirstName(manager?.firstName ?? '');
    setLastName(manager?.lastName ?? '');
    setMobile(manager?.mobile ?? '');
    setJobTitle(manager?.jobTitle ?? '');
  }, []);

  useEffect(() => {
    if (!target) {
      setName('');
      applyManager(null);
      return;
    }
    setName(target.name);
    applyManager(target.managers.length === 1 ? target.managers[0] : null);
  }, [applyManager, target]);

  const close = () => {
    if (busy) return;
    onClose();
  };

  const selectedManager = target?.managers.find((manager) => manager.userId === selectedUserId) ?? null;
  const managerRequired = Boolean(target && target.managers.length > 0);

  return (
    <Modal open={Boolean(target)} onClose={close} title="ویرایش شرکت" wide>
      {target && (
        <form
          className="space-y-5"
          onSubmit={async (event) => {
            event.preventDefault();
            if (managerRequired && !selectedManager) return;
            setBusy(true);
            try {
              const payload: {
                name: string;
                manager?: {
                  userId: string;
                  firstName: string;
                  lastName: string;
                  mobile: string;
                  jobTitle: string | null;
                };
              } = { name: name.trim() };

              if (selectedManager) {
                payload.manager = {
                  userId: selectedManager.userId,
                  firstName: firstName.trim(),
                  lastName: lastName.trim(),
                  mobile,
                  jobTitle: jobTitle.trim() || null,
                };
              }

              const res = await api.patch<{ message: string }>(`/admin/companies/${target.id}`, payload);
              toast.success(res.message);
              onClose();
              await onSaved();
            } catch (err) {
              if (!onAuthFailure(err)) {
                toast.error(err instanceof Error ? err.message : 'خطا در ویرایش شرکت');
              }
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="نام شرکت" required>
            <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} autoFocus />
          </Field>

          <div className="border-t border-workspace-border pt-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-brand-400/20 bg-brand-400/10 text-brand-200">
                <EmployeesIcon className="h-4 w-4" />
              </span>
              <div>
                <h4 className="text-sm font-black text-white">اطلاعات مدیر شرکت</h4>
                <p className="mt-0.5 text-[10px] text-workspace-soft">اطلاعات همان کاربر و عضویت فعلی به‌روزرسانی می‌شود.</p>
              </div>
            </div>

            {target.managers.length > 1 && (
              <div className="mb-4">
                <Field label="مدیر مورد ویرایش" required>
                  <select
                    className={inputClass}
                    value={selectedUserId}
                    onChange={(event) => {
                      const manager = target.managers.find((item) => item.userId === event.target.value) ?? null;
                      applyManager(manager);
                    }}
                  >
                    <option value="">انتخاب مدیر</option>
                    {target.managers.map((manager) => (
                      <option key={manager.membershipId} value={manager.userId}>
                        {manager.fullName} — {manager.mobile} — {manager.isActive ? 'فعال' : 'غیرفعال'}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}

            {target.managers.length === 0 ? (
              <div className="rounded-xl border border-workspace-border bg-workspace-elevated/45 p-3 text-xs leading-6 text-workspace-muted">
                مدیری برای این شرکت ثبت نشده است؛ در این مرحله فقط نام شرکت قابل ویرایش است.
              </div>
            ) : selectedManager ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="نام مدیر" required>
                    <input className={inputClass} value={firstName} onChange={(event) => setFirstName(event.target.value)} />
                  </Field>
                  <Field label="نام خانوادگی مدیر" required>
                    <input className={inputClass} value={lastName} onChange={(event) => setLastName(event.target.value)} />
                  </Field>
                  <Field label="شماره موبایل مدیر" required>
                    <input
                      className={`${inputClass} tnum text-left`}
                      dir="ltr"
                      inputMode="numeric"
                      placeholder="09123456789"
                      value={mobile}
                      onChange={(event) => setMobile(event.target.value)}
                    />
                  </Field>
                  <Field label="سمت مدیر">
                    <input className={inputClass} value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="مدیر شرکت" />
                  </Field>
                </div>
                <p className="rounded-xl border border-workspace-border bg-workspace-elevated/45 px-3 py-2.5 text-[10px] leading-5 text-workspace-soft">
                  این بخش برای اصلاح اطلاعات همان شخص است. برای تغییر شخص مدیر، از «تعویض مدیر» استفاده کنید.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-brand-400/20 bg-brand-400/5 p-3 text-xs leading-6 text-workspace-muted">
                برای ویرایش اطلاعات مدیر، یکی از مدیران این شرکت را انتخاب کنید.
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-workspace-border pt-5 sm:flex-row">
            <button type="button" onClick={close} disabled={busy} className={`${btnSecondary} flex-1`}>
              انصراف
            </button>
            <button
              type="submit"
              disabled={
                busy ||
                name.trim().length < 2 ||
                (managerRequired && (
                  !selectedManager ||
                  !firstName.trim() ||
                  !lastName.trim() ||
                  mobile.trim().length < 10
                ))
              }
              className={`${btnPrimary} flex-1`}
            >
              {busy ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ReplaceManagerModal({
  target,
  onClose,
  onReplaced,
  onAuthFailure,
}: {
  target: ReplaceTarget | null;
  onClose: () => void;
  onReplaced: () => Promise<void>;
  onAuthFailure: (err: unknown) => boolean;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [passwordWasOmitted, setPasswordWasOmitted] = useState(false);

  useEffect(() => {
    setFirstName('');
    setLastName('');
    setMobile('');
    setJobTitle('');
    setPassword('');
    setBusy(false);
    setSuccess(false);
    setPasswordWasOmitted(false);
  }, [target]);

  const close = () => {
    if (busy) return;
    if (success) void onReplaced();
    onClose();
  };

  return (
    <Modal open={Boolean(target)} onClose={close} title="تعویض مدیر" wide>
      {target && (
        success ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4">
              <p className="text-sm font-black text-emerald-200">مدیر جدید جایگزین شد.</p>
              <p className="mt-2 text-xs leading-6 text-workspace-muted">
                مدیر قبلی حذف نشده و عضویت او برای این شرکت غیرفعال شده است. سوابق قبلی حفظ شده‌اند.
              </p>
            </div>
            <div className="rounded-xl border border-brand-400/20 bg-brand-400/5 p-4">
              <p className="text-xs font-black text-white">اتصال تلگرام مدیر جدید</p>
              <p className="mt-2 text-xs leading-6 text-workspace-muted">
                مدیر جدید هنوز به تلگرام متصل نیست. برای اتصال، مدیر جدید ربات فالوآ را باز کند، /start را بزند و شماره موبایل ثبت‌شده خود را از طریق دکمه ارسال شماره تماس تأیید کند.
              </p>
              {passwordWasOmitted && (
                <p className="mt-2 text-xs leading-6 text-amber-200">
                  پس از اتصال تلگرام، مدیر می‌تواند از «فعال‌سازی با کد یکبارمصرف» برای تعیین رمز عبور استفاده کند.
                </p>
              )}
            </div>
            <button type="button" onClick={close} className={btnPrimary}>بستن</button>
          </div>
        ) : (
          <form
            className="space-y-5"
            onSubmit={async (event) => {
              event.preventDefault();
              const ok = await confirm({
                title: 'تعویض مدیر شرکت؟',
                message: 'دسترسی مدیر فعلی به این شرکت غیرفعال می‌شود و مدیر جدید جایگزین او خواهد شد. سوابق قبلی حذف نمی‌شوند.',
                confirmLabel: 'تعویض مدیر',
                danger: true,
              });
              if (!ok) return;

              setBusy(true);
              try {
                const res = await api.post<{ message: string }>(
                  `/admin/companies/${target.company.id}/managers/${target.manager.membershipId}/replace`,
                  {
                    newManager: {
                      firstName: firstName.trim(),
                      lastName: lastName.trim(),
                      mobile,
                      jobTitle: jobTitle.trim() || undefined,
                      password: password || undefined,
                    },
                  },
                );
                toast.success(res.message);
                setPasswordWasOmitted(password.length === 0);
                setSuccess(true);
              } catch (err) {
                if (!onAuthFailure(err)) {
                  toast.error(err instanceof Error ? err.message : 'خطا در تعویض مدیر');
                }
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="rounded-xl border border-workspace-border bg-workspace-elevated/45 p-4">
              <p className="text-[10px] text-workspace-soft">مدیر فعلی شرکت {target.company.name}</p>
              <p className="mt-1 text-sm font-black text-white">{target.manager.fullName}</p>
              <p className="tnum mt-1 text-[10px] text-workspace-muted" dir="ltr">{target.manager.mobile}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="نام مدیر جدید" required>
                <input className={inputClass} value={firstName} onChange={(event) => setFirstName(event.target.value)} autoFocus />
              </Field>
              <Field label="نام خانوادگی" required>
                <input className={inputClass} value={lastName} onChange={(event) => setLastName(event.target.value)} />
              </Field>
              <Field label="شماره موبایل" required>
                <input
                  className={`${inputClass} tnum text-left`}
                  dir="ltr"
                  inputMode="numeric"
                  placeholder="09123456789"
                  value={mobile}
                  onChange={(event) => setMobile(event.target.value)}
                />
              </Field>
              <Field label="سمت">
                <input className={inputClass} value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="مدیر شرکت" />
              </Field>
            </div>

            <Field label="رمز عبور اولیه (اختیاری)">
              <input
                type="password"
                className={inputClass}
                dir="ltr"
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                placeholder="خالی = فعال‌سازی با کد یکبارمصرف"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            <p className="text-[10px] leading-5 text-workspace-soft">
              در صورت خالی بودن، مدیر پس از اتصال تلگرام می‌تواند با کد یکبارمصرف حساب خود را فعال کند.
            </p>

            <div className="flex flex-col-reverse gap-3 border-t border-workspace-border pt-5 sm:flex-row">
              <button type="button" onClick={close} disabled={busy} className={`${btnSecondary} flex-1`}>انصراف</button>
              <button
                type="submit"
                disabled={busy || !firstName.trim() || !lastName.trim() || mobile.trim().length < 10 || (password.length > 0 && password.length < 8)}
                className={`${btnPrimary} flex-1`}
              >
                {busy ? 'در حال تعویض…' : 'تعویض مدیر'}
              </button>
            </div>
          </form>
        )
      )}
    </Modal>
  );
}
