import type { NotificationType } from '@prisma/client';
import type {
  CaseChangedField,
  LoadedNotificationContext,
  NotificationEvent,
} from './notification-context-loader.js';

export interface FormattedNotification {
  title: string;
  body: string;
  type: NotificationType;
  linkType: 'CASE' | 'REMINDER';
  linkId: string;
}

const priorityLabels = {
  LOW: 'کم',
  NORMAL: 'عادی',
  HIGH: 'بالا',
  URGENT: 'فوری',
} as const;

const statusLabels = {
  OPEN: 'باز',
  WAITING_ACCEPTANCE: 'در انتظار پذیرش',
  IN_PROGRESS: 'در حال انجام',
  WAITING_APPROVAL: 'در انتظار تأیید',
  DONE: 'تکمیل‌شده',
  CANCELLED: 'لغوشده',
} as const;

const changedFieldLabels: Record<CaseChangedField, string> = {
  title: 'عنوان پرونده',
  description: 'شرح پرونده',
  caseTypeId: 'نوع پرونده',
  priority: 'اولویت',
  dueDate: 'مهلت',
};

export function truncateNotificationText(value: string, maxLength = 160): string {
  const compact = value
    .replace(/(?:\+98|0098|0)?9[0-9۰-۹٠-٩]{9}/gu, '[شماره تماس حذف شد]')
    .replace(/(?<![0-9۰-۹٠-٩])[0-9۰-۹٠-٩]{10}(?![0-9۰-۹٠-٩])/gu, '[شناسه حساس حذف شد]')
    .replace(/(?:password|secret|token|api[_ -]?key|رمز عبور|توکن)\s*[:=]\s*\S+/giu, '[اطلاعات محرمانه حذف شد]')
    .replace(/\s+/gu, ' ')
    .trim();
  const characters = Array.from(compact);
  return characters.length <= maxLength ? compact : `${characters.slice(0, maxLength - 1).join('').trimEnd()}…`;
}

export function formatPersianDate(value: Date): string {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(value)
    .replace(/[،,]\s*/u, ' - ');
}

const toPersianNumber = (value: number): string =>
  new Intl.NumberFormat('fa-IR', { useGrouping: false }).format(value);

const section = (icon: string, label: string, value?: string | null): string | null => {
  if (!value?.trim()) return null;
  return `${icon} ${label}:\n${truncateNotificationText(value)}`;
};

const commonCaseSections = (context: LoadedNotificationContext): Array<string | null> => [
  section('📌', 'پرونده', `#${toPersianNumber(context.case.number)} - ${context.case.title}`),
  section('👤', 'مشتری', context.case.customer?.name),
  section('🏢', 'شرکت', context.case.company.name),
  section('🗂', 'نوع پرونده', context.case.caseType?.name),
];

const finish = (
  title: string,
  type: NotificationType,
  linkType: 'CASE' | 'REMINDER',
  linkId: string,
  sections: Array<string | null>,
): FormattedNotification => ({
  title,
  type,
  linkType,
  linkId,
  body: sections.filter((value): value is string => Boolean(value)).join('\n\n'),
});

export function formatNotification(
  event: NotificationEvent,
  context: LoadedNotificationContext,
): FormattedNotification {
  const common = commonCaseSections(context);
  const status = section('📊', 'وضعیت فعلی', statusLabels[context.case.status]);
  const priority = section('🔥', 'اولویت', priorityLabels[context.case.priority]);
  const dueDate = context.case.dueDate
    ? section('📅', 'مهلت', formatPersianDate(context.case.dueDate))
    : null;
  const currentOwner = section('👨‍💻', 'مسئول فعلی', context.case.currentOwner?.name);
  const actor = context.actor?.name;
  const assignment = context.assignment;
  const isAssignmentRecipient = assignment?.toUser.id === context.recipient.id;
  const isPreviousOwner = event.kind === 'CASE_TRANSFERRED'
    && event.previousOwnerId === context.recipient.id;

  switch (event.kind) {
    case 'CASE_ASSIGNED':
      return finish(
        '📥 پرونده جدید به شما ارجاع شد',
        'CASE_ASSIGNED',
        'CASE',
        context.case.id,
        [
          ...common,
          section('👨‍💼', 'ارجاع‌دهنده', assignment?.fromUser?.name ?? actor),
          currentOwner,
          section('📝', 'توضیح ارجاع', assignment?.note),
          status,
          priority,
          dueDate,
          section('🕒', 'زمان ارجاع', assignment ? formatPersianDate(assignment.createdAt) : null),
          section('✅', 'اقدام لازم', 'پرونده را بررسی کنید و نتیجه پذیرش یا رد ارجاع را ثبت کنید.'),
        ],
      );

    case 'CASE_TRANSFERRED': {
      const title = isAssignmentRecipient
        ? '🔄 پرونده‌ای به شما منتقل شد'
        : isPreviousOwner
          ? '🔄 انتقال پرونده ثبت شد'
          : '🔄 پرونده منتقل شد';
      const action = isAssignmentRecipient
        ? 'پرونده را بررسی کنید و نتیجه پذیرش یا رد انتقال را ثبت کنید.'
        : isPreviousOwner
          ? 'نیاز به اقدام فوری نیست؛ انتقال پرونده ثبت شده است.'
          : 'پذیرش یا رد پرونده توسط مسئول جدید را پیگیری کنید.';
      return finish(title, isAssignmentRecipient ? 'CASE_ASSIGNED' : 'CASE_UPDATED', 'CASE', context.case.id, [
        ...common,
        section('👨‍💼', 'انتقال‌دهنده', assignment?.fromUser?.name ?? actor),
        section('👨‍💻', 'ارجاع‌شده به', assignment?.toUser.name),
        section('📝', 'دلیل انتقال', assignment?.note),
        status,
        priority,
        dueDate,
        section('🕒', 'زمان انتقال', assignment ? formatPersianDate(assignment.createdAt) : null),
        section('✅', 'اقدام لازم', action),
      ]);
    }

    case 'ASSIGNMENT_ACCEPTED':
      return finish('✅ ارجاع پرونده پذیرفته شد', 'CASE_ACCEPTED', 'CASE', context.case.id, [
        ...common,
        section('👤', 'پذیرنده', actor),
        currentOwner,
        status,
        priority,
        dueDate,
        section('🕒', 'زمان پذیرش', assignment?.respondedAt ? formatPersianDate(assignment.respondedAt) : null),
        section('✅', 'اقدام لازم', context.recipientRole === 'COMPANY_MANAGER'
          ? 'روند انجام پرونده را در صورت نیاز پیگیری کنید.'
          : 'نیاز به اقدام فوری نیست؛ مسئولیت پرونده پذیرفته شده است.'),
      ]);

    case 'ASSIGNMENT_REJECTED':
      return finish('⛔ ارجاع پرونده رد شد', 'CASE_REJECTED', 'CASE', context.case.id, [
        ...common,
        section('👤', 'ردکننده', actor),
        section('📝', 'دلیل رد', assignment?.rejectReason),
        currentOwner,
        status,
        priority,
        dueDate,
        section('🕒', 'زمان رد', assignment?.respondedAt ? formatPersianDate(assignment.respondedAt) : null),
        section('✅', 'اقدام لازم', context.case.currentOwner
          ? 'دلیل رد را بررسی کنید و ادامه پیگیری را هماهنگ کنید.'
          : 'دلیل رد را بررسی کنید و مسئول جدیدی برای پرونده تعیین کنید.'),
      ]);

    case 'CASE_UPDATED':
      return finish('✏️ پرونده به‌روزرسانی شد', 'CASE_UPDATED', 'CASE', context.case.id, [
        ...common,
        section('👤', 'ویرایش‌کننده', actor),
        section('📝', 'موارد تغییرکرده', event.changedFields.map((field) => changedFieldLabels[field]).join('، ')),
        currentOwner,
        status,
        priority,
        dueDate,
        section('🕒', 'زمان به‌روزرسانی', formatPersianDate(context.case.updatedAt)),
        section('✅', 'اقدام لازم', 'تغییرات پرونده را بررسی کنید.'),
      ]);

    case 'RESULT_REGISTERED':
      return finish('📝 نتیجه پرونده ثبت شد', 'CASE_UPDATED', 'CASE', context.case.id, [
        ...common,
        section('👤', 'ثبت‌کننده نتیجه', actor),
        currentOwner,
        status,
        priority,
        dueDate,
        section('🕒', 'زمان ثبت نتیجه', context.case.resultAt ? formatPersianDate(context.case.resultAt) : null),
        section('✅', 'اقدام لازم', 'نتیجه ثبت‌شده و وضعیت ادامه پیگیری را بررسی کنید.'),
      ]);

    case 'CASE_COMPLETED':
      return finish('🏁 پرونده تکمیل شد', 'CASE_COMPLETED', 'CASE', context.case.id, [
        ...common,
        section('👤', 'تکمیل‌کننده', actor),
        currentOwner,
        status,
        priority,
        section('🕒', 'زمان تکمیل', context.case.resultAt ? formatPersianDate(context.case.resultAt) : null),
        section('✅', 'اقدام لازم', context.recipientRole === 'COMPANY_MANAGER'
          ? 'نتیجه نهایی پرونده را بررسی کنید.'
          : 'نیاز به اقدام فوری نیست؛ پرونده تکمیل شده است.'),
      ]);

    case 'FILE_UPLOADED':
      return finish('📎 فایل جدید به پرونده افزوده شد', 'CASE_UPDATED', 'CASE', context.case.id, [
        ...common,
        section('📎', 'نام فایل', context.file?.filename),
        section('👤', 'بارگذاری‌کننده', context.file?.uploader.name ?? actor),
        currentOwner,
        status,
        priority,
        dueDate,
        section('🕒', 'زمان بارگذاری', context.file ? formatPersianDate(context.file.createdAt) : null),
        section('✅', 'اقدام لازم', 'فایل افزوده‌شده را در صورت ارتباط با تصمیم پرونده بررسی کنید.'),
      ]);

    case 'REMINDER_DUE':
      return finish('⏰ زمان پیگیری پرونده رسیده است', 'REMINDER_DUE', 'REMINDER', event.reminderId, [
        ...common,
        section('📝', 'یادداشت پیگیری', context.reminder?.note),
        currentOwner,
        status,
        priority,
        dueDate,
        section('⏰', 'زمان یادآوری', context.reminder ? formatPersianDate(context.reminder.remindAt) : null),
        section('✅', 'اقدام لازم', 'پرونده را پیگیری کنید و نتیجه یا اقدام بعدی را ثبت کنید.'),
      ]);
  }
}
