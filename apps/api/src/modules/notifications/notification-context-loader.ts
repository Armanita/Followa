import type { CasePriority, CaseStatus, CompanyRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export type CaseChangedField = 'title' | 'description' | 'caseTypeId' | 'priority' | 'dueDate';

export type NotificationEvent =
  | { kind: 'CASE_ASSIGNED'; caseId: string; actorUserId: string; assignmentId: string }
  | { kind: 'CASE_TRANSFERRED'; caseId: string; actorUserId: string; assignmentId: string; previousOwnerId: string | null }
  | { kind: 'ASSIGNMENT_ACCEPTED'; caseId: string; actorUserId: string; assignmentId: string }
  | { kind: 'ASSIGNMENT_REJECTED'; caseId: string; actorUserId: string; assignmentId: string }
  | { kind: 'CASE_UPDATED'; caseId: string; actorUserId: string; changedFields: CaseChangedField[] }
  | { kind: 'RESULT_REGISTERED'; caseId: string; actorUserId: string }
  | { kind: 'CASE_COMPLETED'; caseId: string; actorUserId: string }
  | { kind: 'FILE_UPLOADED'; caseId: string; actorUserId: string; fileId: string }
  | { kind: 'REMINDER_DUE'; reminderId: string };

export interface NotificationPersonContext {
  id: string;
  name: string;
}

export interface LoadedNotificationContext {
  recipient: NotificationPersonContext;
  recipientRole: CompanyRole | null;
  actor: NotificationPersonContext | null;
  case: {
    id: string;
    number: number;
    title: string;
    status: CaseStatus;
    priority: CasePriority;
    dueDate: Date | null;
    createdAt: Date;
    updatedAt: Date;
    resultAt: Date | null;
    company: { id: string; name: string };
    customer: { name: string; type: 'INDIVIDUAL' | 'LEGAL' } | null;
    caseType: { name: string } | null;
    createdBy: NotificationPersonContext;
    currentOwner: NotificationPersonContext | null;
  };
  assignment: {
    reason: string;
    note: string | null;
    rejectReason: string | null;
    createdAt: Date;
    respondedAt: Date | null;
    fromUser: NotificationPersonContext | null;
    toUser: NotificationPersonContext;
  } | null;
  reminder: {
    note: string | null;
    remindAt: Date;
    creator: NotificationPersonContext;
  } | null;
  file: {
    filename: string;
    createdAt: Date;
    uploader: NotificationPersonContext;
  } | null;
}

const personName = (person: { firstName: string; lastName: string }): string =>
  `${person.firstName} ${person.lastName}`.trim();

const mapPerson = (person: { id: string; firstName: string; lastName: string }): NotificationPersonContext => ({
  id: person.id,
  name: personName(person),
});

const personSelect = { id: true, firstName: true, lastName: true } as const;

export async function loadNotificationContext(
  event: NotificationEvent,
  recipientUserId: string,
): Promise<LoadedNotificationContext> {
  const reminder = event.kind === 'REMINDER_DUE'
    ? await prisma.reminder.findUniqueOrThrow({
        where: { id: event.reminderId },
        select: {
          caseId: true,
          note: true,
          remindAt: true,
          creator: { select: personSelect },
        },
      })
    : null;
  const caseId = event.kind === 'REMINDER_DUE' ? reminder!.caseId : event.caseId;

  const [caseRecord, recipient, actor, assignment, file] = await Promise.all([
    prisma.case.findUniqueOrThrow({
      where: { id: caseId },
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
        resultAt: true,
        company: { select: { id: true, name: true } },
        customer: { select: { name: true, type: true } },
        caseType: { select: { name: true } },
        createdBy: { select: personSelect },
        currentOwner: { select: personSelect },
      },
    }),
    prisma.user.findUniqueOrThrow({ where: { id: recipientUserId }, select: personSelect }),
    event.kind !== 'REMINDER_DUE'
      ? prisma.user.findUniqueOrThrow({ where: { id: event.actorUserId }, select: personSelect })
      : Promise.resolve(null),
    'assignmentId' in event
      ? prisma.caseAssignment.findFirstOrThrow({
          where: { id: event.assignmentId, caseId },
          select: {
            reason: true,
            note: true,
            rejectReason: true,
            createdAt: true,
            respondedAt: true,
            fromUs: { select: personSelect },
            toUs: { select: personSelect },
          },
        })
      : Promise.resolve(null),
    event.kind === 'FILE_UPLOADED'
      ? prisma.file.findFirstOrThrow({
          where: { id: event.fileId, caseId },
          select: {
            filename: true,
            createdAt: true,
            uploader: { select: personSelect },
          },
        })
      : Promise.resolve(null),
  ]);

  const membership = await prisma.companyMembership.findUnique({
    where: { userId_companyId: { userId: recipientUserId, companyId: caseRecord.company.id } },
    select: { role: true },
  });

  return {
    recipient: mapPerson(recipient),
    recipientRole: membership?.role ?? null,
    actor: actor ? mapPerson(actor) : reminder ? mapPerson(reminder.creator) : null,
    case: {
      ...caseRecord,
      createdBy: mapPerson(caseRecord.createdBy),
      currentOwner: caseRecord.currentOwner ? mapPerson(caseRecord.currentOwner) : null,
    },
    assignment: assignment
      ? {
          ...assignment,
          fromUser: assignment.fromUs ? mapPerson(assignment.fromUs) : null,
          toUser: mapPerson(assignment.toUs),
        }
      : null,
    reminder: reminder
      ? { note: reminder.note, remindAt: reminder.remindAt, creator: mapPerson(reminder.creator) }
      : null,
    file: file
      ? { filename: file.filename, createdAt: file.createdAt, uploader: mapPerson(file.uploader) }
      : null,
  };
}
