'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { btnPrimary, Card, ErrorState, Field, inputClass, Spinner, Toast } from '@/components/ui';
import { SettingsIcon } from '@/components/workspace/icons';
import { PageHeader, PanelHeader } from '@/components/workspace/page';

interface CompanyInfo { id: string; name: string; caseTypes: { id: string; name: string; color: string | null }[]; }

export default function SettingsPage() {
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeColor, setNewTypeColor] = useState('#7c4dff');
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [role, setRole] = useState('');
  const showToast = (message: string, tone: 'success' | 'error') => { setToast({ message, tone }); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async () => {
    try {
      const res = await api.get<CompanyInfo>('/companies/current');
      setCompany(res);
      const profile = await api.get<{ role: string }>('/profile');
      setRole(profile.role ?? '');
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  if (loading) return <Spinner />;
  if (error || !company) return <ErrorState message={error || 'اطلاعات شرکت در دسترس نیست'} onRetry={load} />;
  const isManager = role === 'COMPANY_MANAGER';

  const addCaseType = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api.post('/case-types', { name: newTypeName, color: newTypeColor }); showToast('نوع پرونده اضافه شد', 'success'); setNewTypeName(''); void load(); }
    catch (err) { showToast(err instanceof Error ? err.message : 'خطا', 'error'); }
  };

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.message} tone={toast.tone} />}
      <PageHeader eyebrow="پیکربندی" title="تنظیمات" description="تنظیمات پایه شرکت و دسته‌بندی پرونده‌ها را از این بخش مدیریت کنید." icon={<SettingsIcon className="h-5 w-5" />} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,.8fr)]">
        <Card className="overflow-hidden">
          <PanelHeader title="انواع پرونده" description="دسته‌بندی‌هایی که هنگام ایجاد پرونده در اختیار کاربران قرار می‌گیرند." />
          <div className="p-5">
            <div className="flex flex-wrap gap-2">
              {company.caseTypes.map((type) => (
                <span key={type.id} className="inline-flex items-center gap-2 rounded-xl border border-workspace-border bg-workspace-elevated px-3 py-2 text-xs font-semibold text-workspace-muted">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: type.color ?? '#64748b' }} />{type.name}
                </span>
              ))}
              {company.caseTypes.length === 0 && <p className="text-xs text-workspace-soft">هنوز نوعی تعریف نشده است.</p>}
            </div>
            {isManager && (
              <form onSubmit={addCaseType} className="mt-5 grid gap-3 border-t border-workspace-border pt-5 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                <Field label="نام نوع جدید"><input className={inputClass} value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} placeholder="مثلاً: پیگیری مالی" /></Field>
                <Field label="رنگ"><input type="color" className="h-10 w-16 cursor-pointer rounded-xl border border-workspace-borderStrong bg-workspace-elevated p-1" value={newTypeColor} onChange={(e) => setNewTypeColor(e.target.value)} /></Field>
                <button disabled={newTypeName.length < 2} className={btnPrimary.replace('w-full', '')}>افزودن</button>
              </form>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <PanelHeader title="شرکت" description="هویت سازمانی متصل به حساب جاری" />
          <div className="p-5">
            <div className="flex items-center gap-3 rounded-2xl border border-workspace-border bg-workspace-elevated/60 p-4">
              <span className="grid h-12 w-12 place-items-center rounded-xl border border-brand-400/20 bg-brand-400/10 text-sm font-black text-brand-200">{company.name.charAt(0)}</span>
              <div className="min-w-0"><p className="truncate text-sm font-black text-white">{company.name}</p><p className="mt-1 text-[10px] text-workspace-soft">شرکت جاری فالوآ</p></div>
            </div>
            <div className="mt-4 rounded-xl border border-workspace-border bg-workspace-elevated/40 px-3.5 py-3 text-[11px] leading-6 text-workspace-muted">{isManager ? 'مدیریت تنظیمات پایه برای نقش مدیر فعال است.' : 'تنظیمات پیشرفته فقط برای مدیر شرکت قابل تغییر است.'}</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
