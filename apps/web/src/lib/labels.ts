export const CASE_STATUS_LABELS: Record<string, string> = {
  OPEN: 'باز',
  WAITING_ACCEPTANCE: 'در انتظار پذیرش',
  IN_PROGRESS: 'در حال انجام',
  WAITING_APPROVAL: 'در انتظار تأیید',
  DONE: 'تکمیل شده',
  CANCELLED: 'لغو شده',
};

export const CASE_STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-sky-50 text-sky-700 ring-sky-200',
  WAITING_ACCEPTANCE: 'bg-amber-50 text-amber-700 ring-amber-200',
  IN_PROGRESS: 'bg-brand-50 text-brand-700 ring-brand-200',
  WAITING_APPROVAL: 'bg-violet-50 text-violet-700 ring-violet-200',
  DONE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  CANCELLED: 'bg-slate-100 text-slate-500 ring-slate-200',
};

export const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'کم',
  NORMAL: 'معمولی',
  HIGH: 'زیاد',
  URGENT: 'فوری',
};

export const PRIORITY_STYLES: Record<string, string> = {
  LOW: 'bg-slate-50 text-slate-600 ring-slate-200',
  NORMAL: 'bg-slate-50 text-slate-600 ring-slate-200',
  HIGH: 'bg-orange-50 text-orange-700 ring-orange-200',
  URGENT: 'bg-red-50 text-red-700 ring-red-200',
};

export const ACTIVITY_LABELS: Record<string, string> = {
  CREATE: 'پرونده ایجاد شد',
  ASSIGN: 'ارجاع داده شد',
  ACCEPT: 'پذیرفته شد',
  REJECT: 'رد شد',
  START_WORK: 'شروع کار',
  END_WORK: 'پایان کار',
  RESULT_ADDED: 'نتیجه ثبت شد',
  FILE_UPLOADED: 'فایل پیوست شد',
  COMPLETE: 'تکمیل شد',
  CANCEL: 'لغو شد',
  REMINDER_CREATED: 'یادآوری ساخته شد',
  REMINDER_DONE: 'یادآوری انجام شد',
};

export const ASSIGNMENT_REASON_LABELS: Record<string, string> = {
  INITIAL_ASSIGNMENT: 'ارجاع اولیه',
  TRANSFER: 'انتقال',
  RETURN_AFTER_REJECT: 'بازگشت به دلیل رد',
};

export const NOTIFICATION_LABELS: Record<string, string> = {
  CASE_ASSIGNED: 'ارجاع پرونده',
  CASE_ACCEPTED: 'پذیرش ارجاع',
  CASE_REJECTED: 'رد ارجاع',
  REMINDER_DUE: 'سررسید یادآوری',
  CASE_COMPLETED: 'تکمیل پرونده',
  CASE_UPDATED: 'به‌روزرسانی پرونده',
};
