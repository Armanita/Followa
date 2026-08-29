'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { btnPrimary, Field, inputClass, Modal, useToast } from '@/components/ui';

interface TransferCandidate {
  userId: string;
  fullName: string;
  jobTitle: string | null;
}

export function CaseTransferModal({
  open,
  onClose,
  caseId,
  onDone,
  title = 'انتقال پرونده',
}: {
  open: boolean;
  onClose: () => void;
  caseId: string;
  onDone: () => void | Promise<void>;
  title?: string;
}) {
  const toast = useToast();
  const [candidates, setCandidates] = useState<TransferCandidate[]>([]);
  const [toUser, setToUser] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setCandidates([]);
    setToUser('');
    setNote('');
    setLoadError('');
    setLoading(true);
    void api
      .get<{ items: TransferCandidate[] }>('/members/transfer-candidates')
      .then((response) => {
        if (active) setCandidates(response.items);
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'دریافت فهرست همکاران ناموفق بود');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (!toUser || busy) return;
          setBusy(true);
          try {
            await api.post(`/cases/${caseId}/transfer`, {
              toUserId: toUser,
              ...(note.trim() ? { note: note.trim() } : {}),
            });
            toast.success('پرونده برای همکار جدید ارجاع شد');
            onClose();
            await onDone();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'خطا در انتقال پرونده');
          } finally {
            setBusy(false);
          }
        }}
        className="space-y-4"
      >
        <div className="rounded-xl border border-workspace-border bg-workspace-elevated/60 px-3.5 py-3 text-[11px] leading-6 text-workspace-muted">
          فقط کارکنان فعال همین شرکت در این فهرست نمایش داده می‌شوند. پس از انتقال، پرونده تا پاسخ گیرنده در وضعیت «در انتظار پذیرش» قرار می‌گیرد.
        </div>

        <Field label="ارجاع به" required>
          <select
            className={inputClass}
            value={toUser}
            onChange={(event) => setToUser(event.target.value)}
            disabled={loading || candidates.length === 0}
            autoFocus
          >
            <option value="">{loading ? 'در حال دریافت همکاران…' : '— انتخاب همکار —'}</option>
            {candidates.map((candidate) => (
              <option key={candidate.userId} value={candidate.userId}>
                {candidate.fullName}{candidate.jobTitle ? ` — ${candidate.jobTitle}` : ''}
              </option>
            ))}
          </select>
        </Field>

        {loadError && (
          <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-3.5 py-3 text-xs text-red-200">
            {loadError}
          </p>
        )}
        {!loading && !loadError && candidates.length === 0 && (
          <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3.5 py-3 text-xs text-amber-200">
            همکار فعال دیگری برای انتقال پرونده وجود ندارد.
          </p>
        )}

        <Field label="یادداشت انتقال">
          <textarea
            className={`${inputClass} min-h-24`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={1000}
            placeholder="وضعیت فعلی، نکات مهم و ادامه کار برای گیرنده…"
          />
        </Field>

        <button disabled={busy || loading || Boolean(loadError) || !toUser} className={btnPrimary}>
          {busy ? 'در حال ارجاع…' : 'تأیید انتقال'}
        </button>
      </form>
    </Modal>
  );
}
