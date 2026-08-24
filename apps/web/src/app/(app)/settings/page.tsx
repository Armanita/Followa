'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { btnPrimary, Card, Field, inputClass, Spinner, Toast } from '@/components/ui';

interface CompanyInfo {
  id: string;
  name: string;
  caseTypes: { id: string; name: string; color: string | null }[];
}

export default function SettingsPage() {
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeColor, setNewTypeColor] = useState('#2563eb');
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [role, setRole] = useState<string>('');

  const showToast = (message: string, tone: 'success' | 'error') => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    try {
      const res = await api.get<CompanyInfo>('/companies/current');
      setCompany(res);
      const profile = await api.get<{ role: string }>('/profile');
      setRole(profile.role ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Spinner />;
  if (error || !company) return <p className="text-sm text-red-600">{error}</p>;

  const isManager = role === 'COMPANY_MANAGER';

  const addCaseType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/case-types', { name: newTypeName, color: newTypeColor });
      showToast('نوع پرونده اضافه شد', 'success');
      setNewTypeName('');
      void load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'خطا', 'error');
    }
  };

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.message} tone={toast.tone} />}
      <div>
        <h1 className="text-xl font-extrabold">تنظیمات</h1>
        <p className="mt-0.5 text-sm text-slate-500">تنظیمات شرکت</p>
      </div>

      <Card className="p-5">
        <h2 className="mb-1 font-bold">شرکت</h2>
        <p className="text-sm text-slate-500">نام شرکت: {company.name}</p>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 font-bold">انواع پرونده</h2>
        <div className="flex flex-wrap gap-2">
          {company.caseTypes.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ring-1 ring-inset"
              style={{ color: t.color ?? '#334155', backgroundColor: `${t.color ?? '#64748b'}14`, ['--tw-ring-color' as string]: `${t.color ?? '#64748b'}40` }}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color ?? '#64748b' }} />
              {t.name}
            </span>
          ))}
          {company.caseTypes.length === 0 && (
            <p className="text-sm text-slate-400">هنوز نوعی تعریف نشده است.</p>
          )}
        </div>

        {isManager && (
          <form onSubmit={addCaseType} className="mt-5 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
            <div className="min-w-48 flex-1">
              <Field label="نام نوع جدید">
                <input className={inputClass} value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} placeholder="مثلاً: پیگیری مالی" />
              </Field>
            </div>
            <Field label="رنگ">
              <input type="color" className="h-10 w-16 cursor-pointer rounded-lg border border-slate-200" value={newTypeColor} onChange={(e) => setNewTypeColor(e.target.value)} />
            </Field>
            <button disabled={newTypeName.length < 2} className={`${btnPrimary.replace('w-full', '')}`}>
              افزودن
            </button>
          </form>
        )}
      </Card>

      {!isManager && (
        <Card className="p-5">
          <p className="text-sm text-slate-500">تنظیمات پیشرفته فقط برای مدیر شرکت فعال است.</p>
        </Card>
      )}
    </div>
  );
}
