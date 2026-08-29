'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CASE_STATUS_LABELS, PRIORITY_LABELS } from '@/lib/labels';

const STATUS_STYLES: Record<string, string> = {
  OPEN: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
  WAITING_ACCEPTANCE: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  IN_PROGRESS: 'border-indigo-400/20 bg-indigo-400/10 text-indigo-300',
  WAITING_APPROVAL: 'border-violet-400/20 bg-violet-400/10 text-violet-300',
  DONE: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  CANCELLED: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
};

const PRIORITY_STYLES: Record<string, string> = {
  LOW: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
  HIGH: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  URGENT: 'border-red-400/20 bg-red-400/10 text-red-300',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLES[status] ?? 'border-workspace-border bg-workspace-elevated text-workspace-muted'}`}>
      {CASE_STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  if (priority === 'NORMAL') return null;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${PRIORITY_STYLES[priority] ?? 'border-workspace-border bg-workspace-elevated text-workspace-muted'}`}>
      {priority === 'URGENT' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />}
      {PRIORITY_LABELS[priority] ?? priority}
    </span>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-workspace-border bg-workspace-surface shadow-card ${className}`}>{children}</div>;
}

export function StatCard({ label, value, tone = 'default' }: { label: string; value: string | number; tone?: 'default' | 'warning' | 'danger' | 'success' }) {
  const tones = {
    default: 'text-brand-300',
    warning: 'text-amber-300',
    danger: 'text-red-300',
    success: 'text-emerald-300',
  };
  return (
    <Card className="p-4">
      <p className="text-[11px] font-medium text-workspace-muted">{label}</p>
      <p className={`tnum mt-2 text-2xl font-black ${tones[tone]}`}>{value}</p>
    </Card>
  );
}

export function Spinner({ label = 'در حال بارگذاری…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-workspace-muted">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-workspace-borderStrong border-t-brand-400" />
      <span className="text-xs">{label}</span>
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-workspace-border bg-workspace-elevated text-workspace-muted">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>
      </div>
      <p className="text-sm font-bold text-workspace-ink">{title}</p>
      {hint && <p className="max-w-sm text-xs leading-6 text-workspace-soft">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-red-400/20 bg-red-400/10 text-red-300">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 8v5M12 17h.01"/><path d="M10.3 3.7 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z"/></svg>
      </div>
      <p className="text-sm font-semibold text-red-300">{message}</p>
      {onRetry && <button onClick={onRetry} className="rounded-lg border border-workspace-borderStrong bg-workspace-elevated px-4 py-2 text-xs font-semibold text-workspace-muted transition hover:bg-workspace-hover hover:text-white">تلاش دوباره</button>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-[4px] sm:items-center sm:p-6" onClick={onClose}>
      <div className={`max-h-[90vh] w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'} overflow-y-auto rounded-t-3xl border border-workspace-border bg-workspace-surface p-6 shadow-pop sm:rounded-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between gap-4 border-b border-workspace-border pb-4">
          <h3 className="text-base font-black text-white">{title}</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg border border-workspace-border text-workspace-muted transition hover:bg-workspace-hover hover:text-white" aria-label="بستن">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-workspace-muted">{label}{required && <span className="text-red-400"> *</span>}</span>
      {children}
    </label>
  );
}

export const inputClass = 'w-full rounded-xl border border-workspace-borderStrong bg-workspace-elevated px-3.5 py-2.5 text-sm text-workspace-ink outline-none transition placeholder:text-workspace-soft focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50';
export const btnPrimary = 'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(109,54,237,.20)] transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60';
export const btnSecondary = 'inline-flex items-center justify-center gap-2 rounded-xl border border-workspace-borderStrong bg-workspace-elevated px-4 py-2.5 text-sm font-semibold text-workspace-muted transition hover:bg-workspace-hover hover:text-white disabled:opacity-60';

export function Toast({ message, tone }: { message: string; tone: 'success' | 'error' }) {
  const styles = { success: 'border-emerald-400/20 bg-emerald-500 text-white', error: 'border-red-400/20 bg-red-500 text-white' };
  return <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex flex-col items-center gap-2 px-4"><div role="status" className={`flex max-w-md items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-semibold shadow-pop ${styles[tone]}`}><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/15 text-xs">{tone === 'success' ? '✓' : '!'}</span>{message}</div></div>;
}

interface ToastContextValue { success: (message: string) => void; error: (message: string) => void; }
const ToastContext = createContext<ToastContextValue | null>(null);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; message: string; tone: 'success' | 'error' }[]>([]);
  const push = useCallback((message: string, tone: 'success' | 'error') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  const value = useMemo<ToastContextValue>(() => ({ success: (m) => push(m, 'success'), error: (m) => { const friendly = m?.includes('{') || m?.includes('"statusCode"') ? 'خطایی رخ داد. لطفاً دوباره تلاش کنید.' : m || 'خطای غیرمنتظره'; push(friendly, 'error'); } }), [push]);
  return <ToastContext.Provider value={value}>{children}{toasts.map((t) => <Toast key={t.id} message={t.message} tone={t.tone} />)}</ToastContext.Provider>;
}
export function useToast(): ToastContextValue { const ctx = useContext(ToastContext); if (!ctx) throw new Error('useToast must be used inside ToastProvider'); return ctx; }

interface ConfirmOptions { title: string; message?: string; confirmLabel?: string; danger?: boolean; }
const ConfirmContext = createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(null);
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (result: boolean) => { state?.resolve(result); setState(null); };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-[4px] sm:items-center sm:p-6" onClick={() => close(false)}>
          <div className="w-full max-w-sm rounded-t-3xl border border-workspace-border bg-workspace-surface p-6 shadow-pop sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start gap-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-sm font-black ${state.danger ? 'border-red-400/20 bg-red-400/10 text-red-300' : 'border-brand-400/20 bg-brand-400/10 text-brand-200'}`}>{state.danger ? '!' : '?'}</span>
              <div><h3 className="font-black text-white">{state.title}</h3>{state.message && <p className="mt-1 text-xs leading-6 text-workspace-muted">{state.message}</p>}</div>
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={() => close(true)} autoFocus className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition ${state.danger ? 'bg-red-600 hover:bg-red-500' : 'bg-brand-600 hover:bg-brand-500'}`}>{state.confirmLabel ?? 'تأیید'}</button>
              <button onClick={() => close(false)} className={`${btnSecondary} flex-1`}>انصراف</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
export function useConfirm() { const ctx = useContext(ConfirmContext); if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider'); return ctx; }
