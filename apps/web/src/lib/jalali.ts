import { format, formatDistanceStrict } from 'date-fns-jalali';
import { faIR } from 'date-fns-jalali/locale';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function toFa(input: string | number): string {
  return String(input).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

/** e.g. ۱۴ مرداد ۱۴۰۵ */
export function faDate(date: string | Date): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return toFa(format(d, 'd MMMM yyyy', { locale: faIR }));
}

/** e.g. ۱۴ مرداد ۱۴۰۵، ۰۹:۳۰ */
export function faDateTime(date: string | Date): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return toFa(format(d, 'd MMMM yyyy، HH:mm', { locale: faIR }));
}

/** e.g. «۲ ساعت و ۱۵ دقیقه» or relative-ish strict distance */
export function faDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '۰ دقیقه';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${toFa(hours)} ساعت و ${toFa(minutes)} دقیقه`;
  if (hours > 0) return `${toFa(hours)} ساعت`;
  return `${toFa(minutes || 1)} دقیقه`;
}

export function isLate(dueDate: string | null | undefined, status: string): boolean {
  if (!dueDate) return false;
  if (['DONE', 'CANCELLED'].includes(status)) return false;
  return new Date(dueDate).getTime() < Date.now();
}
