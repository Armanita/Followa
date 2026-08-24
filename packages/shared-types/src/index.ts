// Shared domain types used by API, web and mobile clients.

export const CASE_STATUSES = [
  'OPEN',
  'WAITING_ACCEPTANCE',
  'IN_PROGRESS',
  'WAITING_APPROVAL',
  'DONE',
  'CANCELLED',
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CASE_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export type CasePriority = (typeof CASE_PRIORITIES)[number];

export const ASSIGNMENT_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED'] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const ACTIVITY_TYPES = [
  'CREATE',
  'ASSIGN',
  'ACCEPT',
  'REJECT',
  'START_WORK',
  'END_WORK',
  'RESULT_ADDED',
  'FILE_UPLOADED',
  'COMPLETE',
  'CANCEL',
  'REMINDER_CREATED',
  'REMINDER_DONE',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const COMPANY_ROLES = ['COMPANY_MANAGER', 'EMPLOYEE'] as const;
export type CompanyRole = (typeof COMPANY_ROLES)[number];

export interface AuthUser {
  id: string;
  mobile: string;
  firstName: string;
  lastName: string;
  role: CompanyRole | null;
  companyId: string | null;
  membershipId: string | null;
}

export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
