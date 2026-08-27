import { format, parse } from 'date-fns-jalali';
import { faIR } from 'date-fns-jalali/locale';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function toFa(input: string | number): string {
  return String(input).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

export function toEn(input: string | number): string {
  return String(input)
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
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

/** Form-friendly Jalali date, e.g. ۱۴۰۵/۰۶/۰۷. */
export function faDateInput(date: string | Date): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  return toFa(format(d, 'yyyy/MM/dd'));
}

/**
 * Converts a Jalali date + 24-hour time entered by the user to an ISO timestamp.
 * Accepts Persian, Arabic, or Latin digits and `/` or `-` date separators.
 */
export function jalaliDateTimeToIso(dateText: string, timeText: string): string {
  const normalizedDate = toEn(dateText.trim()).replace(/-/g, '/');
  const normalizedTime = toEn(timeText.trim());
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(normalizedDate)) {
    throw new Error('تاریخ را به شکل ۱۴۰۵/۰۶/۰۷ وارد کنید');
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(normalizedTime)) {
    throw new Error('ساعت را به شکل ۰۹:۳۰ وارد کنید');
  }

  const parsed = parse(`${normalizedDate} ${normalizedTime}`, 'yyyy/MM/dd HH:mm', new Date());
  if (Number.isNaN(parsed.getTime()) || format(parsed, 'yyyy/MM/dd') !== normalizedDate) {
    throw new Error('تاریخ شمسی معتبر نیست');
  }
  return parsed.toISOString();
}

/** e.g. «۲ ساعت و ۱۵ دقیقه» */
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
