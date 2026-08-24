'use client';

import { useEffect } from 'react';
import {
  CASE_STATUS_LABELS,
  CASE_STATUS_STYLES,
  PRIORITY_LABELS,
  PRIORITY_STYLES,
} from '@/lib/labels';

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        CASE_STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-600 ring-slate-200'
      }`}
    >
      {CASE_STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  if (priority === 'NORMAL') return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
        PRIORITY_STYLES[priority] ?? ''
      }`}
    >
      {priority === 'URGENT' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />}
      {PRIORITY_LABELS[priority] ?? priority}
    </span>
  );
}

export function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70 ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  tone?: 'default' | 'warning' | 'danger' | 'success';
}) {
  const tones = {
    default: 'text-brand-600',
    warning: 'text-amber-600',
    danger: 'text-red-600',
    success: 'text-emerald-600',
  };
  return (
    <Card className="p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`tnum mt-1.5 text-2xl font-bold ${tones[tone]}`}>{value}</p>
    </Card>
  );
}

export function Spinner({ label = 'در حال بارگذاری…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-slate-400">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-brand-500" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl">
        📋
      </div>
      <p className="font-semibold text-slate-700">{title}</p>
      {hint && <p className="max-w-xs text-sm text-slate-400">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-xl">⚠️</div>
      <p className="text-sm font-medium text-red-600">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-lg border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          تلاش دوباره
        </button>
      )}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className={`max-h-[90vh] w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'} overflow-y-auto rounded-t-3xl bg-white p-6 shadow-pop sm:rounded-3xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
            aria-label="بستن"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100';

export const btnPrimary =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60';

export const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60';

export function Toast({ message, tone }: { message: string; tone: 'success' | 'error' }) {
  return (
    <div
      className={`fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-medium text-white shadow-pop ${
        tone === 'success' ? 'bg-emerald-600' : 'bg-red-600'
      }`}
    >
      {message}
    </div>
  );
}
