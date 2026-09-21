import { describe, expect, it } from 'vitest';
import type {
  LoadedNotificationContext,
  NotificationEvent,
} from '../src/modules/notifications/notification-context-loader.js';
import {
  formatNotification,
  formatPersianDate,
} from '../src/modules/notifications/notification-formatter.js';

const employeeContext = (): LoadedNotificationContext => ({
  recipient: { id: 'employee-2', name: 'مریم احمدی' },
  recipientRole: 'EMPLOYEE',
  actor: { id: 'manager-1', name: 'علی رضایی' },
  case: {
    id: 'case-124',
    number: 124,
    title: 'پیگیری قرارداد مشتری',
    status: 'WAITING_ACCEPTANCE',
    priority: 'URGENT',
    dueDate: new Date('2026-09-23T07:00:00.000Z'),
    createdAt: new Date('2026-09-20T08:00:00.000Z'),
    updatedAt: new Date('2026-09-21T08:30:00.000Z'),
    resultAt: new Date('2026-09-21T09:00:00.000Z'),
    company: { id: 'company-1', name: 'شرکت نمونه' },
    customer: { name: 'محمد احمدی', type: 'INDIVIDUAL' },
    caseType: { name: 'قرارداد' },
    createdBy: { id: 'manager-1', name: 'علی رضایی' },
    currentOwner: { id: 'employee-2', name: 'مریم احمدی' },
  },
  assignment: {
    reason: 'INITIAL_ASSIGNMENT',
    note: 'لطفاً قرارداد را تا پایان مهلت بررسی کنید.',
    rejectReason: null,
    createdAt: new Date('2026-09-21T07:00:00.000Z'),
    respondedAt: null,
    fromUser: { id: 'manager-1', name: 'علی رضایی' },
    toUser: { id: 'employee-2', name: 'مریم احمدی' },
  },
  reminder: {
    note: 'برای دریافت پاسخ مشتری پیگیری شود.',
    remindAt: new Date('2026-09-22T06:30:00.000Z'),
    creator: { id: 'employee-2', name: 'مریم احمدی' },
  },
  file: {
    filename: 'قرارداد-نهایی.pdf',
    createdAt: new Date('2026-09-21T08:45:00.000Z'),
    uploader: { id: 'manager-1', name: 'علی رضایی' },
  },
});

describe('notification formatter', () => {
  it('formats a complete assignment with operational case, customer, company and people context', () => {
    const context = employeeContext();
    const notification = formatNotification({
      kind: 'CASE_ASSIGNED',
      caseId: context.case.id,
      actorUserId: context.actor!.id,
      assignmentId: 'assignment-1',
    }, context);

    expect(notification).toMatchObject({
      title: '📥 پرونده جدید به شما ارجاع شد',
      type: 'CASE_ASSIGNED',
      linkType: 'CASE',
      linkId: 'case-124',
    });
    expect(notification.body).toContain('#۱۲۴ - پیگیری قرارداد مشتری');
    expect(notification.body).toContain('👤 مشتری:\nمحمد احمدی');
    expect(notification.body).toContain('🏢 شرکت:\nشرکت نمونه');
    expect(notification.body).toContain('👨‍💼 ارجاع‌دهنده:\nعلی رضایی');
    expect(notification.body).toContain('👨‍💻 مسئول فعلی:\nمریم احمدی');
    expect(notification.body).toContain('🔥 اولویت:\nفوری');
    expect(notification.body).toContain('📊 وضعیت فعلی:\nدر انتظار پذیرش');
    expect(notification.body).toContain('پذیرش یا رد ارجاع');
  });

  it('omits optional sections cleanly when optional context is missing', () => {
    const context = employeeContext();
    context.case.customer = null;
    context.case.caseType = null;
    context.case.currentOwner = null;
    context.case.dueDate = null;
    context.assignment!.note = null;

    const notification = formatNotification({
      kind: 'CASE_TRANSFERRED',
      caseId: context.case.id,
      actorUserId: context.actor!.id,
      assignmentId: 'assignment-1',
      previousOwnerId: 'previous-owner',
    }, context);

    expect(notification.body).not.toContain('مشتری:');
    expect(notification.body).not.toContain('نوع پرونده:');
    expect(notification.body).not.toContain('مسئول فعلی:');
    expect(notification.body).not.toContain('مهلت:');
    expect(notification.body).not.toContain('undefined');
    expect(notification.body).not.toContain('null');
  });

  it('formats transfer actions for the assignment recipient and a manager differently', () => {
    const event: NotificationEvent = {
      kind: 'CASE_TRANSFERRED',
      caseId: 'case-124',
      actorUserId: 'manager-1',
      assignmentId: 'assignment-1',
      previousOwnerId: 'previous-owner',
    };
    const employeeMessage = formatNotification(event, employeeContext());

    const managerContext = employeeContext();
    managerContext.recipient = { id: 'manager-2', name: 'سارا محمدی' };
    managerContext.recipientRole = 'COMPANY_MANAGER';
    const managerMessage = formatNotification(event, managerContext);

    expect(employeeMessage.title).toBe('🔄 پرونده‌ای به شما منتقل شد');
    expect(employeeMessage.type).toBe('CASE_ASSIGNED');
    expect(employeeMessage.body).toContain('نتیجه پذیرش یا رد انتقال را ثبت کنید');
    expect(managerMessage.title).toBe('🔄 پرونده منتقل شد');
    expect(managerMessage.type).toBe('CASE_UPDATED');
    expect(managerMessage.body).toContain('مسئول جدید را پیگیری کنید');

    const previousOwnerContext = employeeContext();
    previousOwnerContext.recipient = { id: 'previous-owner', name: 'رضا کریمی' };
    previousOwnerContext.recipientRole = 'EMPLOYEE';
    const previousOwnerMessage = formatNotification(event, previousOwnerContext);
    expect(previousOwnerMessage.title).toBe('🔄 انتقال پرونده ثبت شد');
    expect(previousOwnerMessage.body).toContain('نیاز به اقدام فوری نیست');
    expect(previousOwnerMessage.body).toContain('مریم احمدی');
  });

  it('keeps customer and company visible across every supported event', () => {
    const context = employeeContext();
    const events: NotificationEvent[] = [
      { kind: 'CASE_ASSIGNED', caseId: 'case-124', actorUserId: 'manager-1', assignmentId: 'assignment-1' },
      { kind: 'CASE_TRANSFERRED', caseId: 'case-124', actorUserId: 'manager-1', assignmentId: 'assignment-1', previousOwnerId: 'previous-owner' },
      { kind: 'ASSIGNMENT_ACCEPTED', caseId: 'case-124', actorUserId: 'employee-2', assignmentId: 'assignment-1' },
      { kind: 'ASSIGNMENT_REJECTED', caseId: 'case-124', actorUserId: 'employee-2', assignmentId: 'assignment-1' },
      { kind: 'CASE_UPDATED', caseId: 'case-124', actorUserId: 'employee-2', changedFields: ['priority'] },
      { kind: 'RESULT_REGISTERED', caseId: 'case-124', actorUserId: 'employee-2' },
      { kind: 'CASE_COMPLETED', caseId: 'case-124', actorUserId: 'employee-2' },
      { kind: 'FILE_UPLOADED', caseId: 'case-124', actorUserId: 'employee-2', fileId: 'file-1' },
      { kind: 'REMINDER_DUE', reminderId: 'reminder-1' },
    ];

    for (const event of events) {
      const notification = formatNotification(event, context);
      expect(notification.body, event.kind).toContain('محمد احمدی');
      expect(notification.body, event.kind).toContain('شرکت نمونه');
    }
  });

  it('redacts sensitive values from user-entered notification fields', () => {
    const context = employeeContext();
    context.assignment!.note = 'تماس 09121234567، کد ملی 0012345678، token=top-secret';

    const notification = formatNotification({
      kind: 'CASE_ASSIGNED',
      caseId: 'case-124',
      actorUserId: 'manager-1',
      assignmentId: 'assignment-1',
    }, context);

    expect(notification.body).not.toContain('09121234567');
    expect(notification.body).not.toContain('0012345678');
    expect(notification.body).not.toContain('top-secret');
    expect(notification.body).toContain('[شماره تماس حذف شد]');
    expect(notification.body).toContain('[شناسه حساس حذف شد]');
    expect(notification.body).toContain('[اطلاعات محرمانه حذف شد]');
  });

  it('renders timestamps with Persian digits and the Persian calendar', () => {
    const formatted = formatPersianDate(new Date('2026-09-23T07:00:00.000Z'));

    expect(formatted).toMatch(/[۰-۹]/u);
    expect(formatted).toContain('۱۴۰۵');
    expect(formatted).not.toContain('2026');
    expect(formatted).toContain(' - ');
  });
});
