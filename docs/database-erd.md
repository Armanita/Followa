# Followa Database ERD

PostgreSQL, managed by Prisma (`apps/api/prisma/schema.prisma`). One migration: `init`.

## Entity Relationship Overview

```
SystemAdmin (standalone platform identity)

User ──< CompanyMembership >── Company
                                  │
                    ┌─────────────┼──────────────────┐
                    ▼             ▼                  ▼
                CaseType        Case ◀── created_by ─ User
                                  │
      ┌──────────┬────────┬───────┼────────┬───────────┐
      ▼          ▼        ▼       ▼        ▼           ▼
CaseAssignment CaseActivity WorkSession Reminder  File   Notification*
                                                     (per-user)

Notification belongs to User only.
```

## Tables

### system_admins
| column | type | notes |
|---|---|---|
| id | text PK (cuid) | |
| username | text unique | |
| passwordHash | text | bcrypt |

### users
| column | type | notes |
|---|---|---|
| id | text PK | |
| mobile | text **unique** | login identifier |
| passwordHash | text? | null until OTP signup completes |
| firstName / lastName | text | |
| nationalId, birthDate, phone, address, maritalStatus, bankCardNumber, bankIban, bankName | nullable | profile fields per spec §5 |

### companies
id PK · name · isActive (default true) · timestamps

### company_memberships
- `@@unique([userId, companyId])`, index `(companyId, isActive)`
- role enum: `COMPANY_MANAGER` | `EMPLOYEE`
- isActive (suspend switch) · jobTitle · employeeCode

### case_types
- unique `(companyId, name)` · color (hex string) · isActive

### cases
| column | type |
|---|---|
| number | int **unique autoincrement** (global sequence) |
| companyId → companies | FK |
| caseTypeId → case_types? | FK nullable |
| currentOwnerId → users? | FK nullable (null while WAITING_ACCEPTANCE) |
| createdById → users | FK |
| status enum | OPEN, WAITING_ACCEPTANCE, IN_PROGRESS, WAITING_APPROVAL, DONE, CANCELLED |
| priority enum | LOW, NORMAL, HIGH, URGENT |
| title, description?, dueDate?, result?, resultAt? | |

Indexes: `(companyId, status)`, `(companyId, currentOwnerId)`.

### case_assignments
caseId FK (cascade) · fromUserId? · toUserId · reason enum (`INITIAL_ASSIGNMENT`/`TRANSFER`/`RETURN_AFTER_REJECT`) · status enum (`PENDING`/`ACCEPTED`/`REJECTED`) · note? · rejectReason? · respondedAt?
Indexes: `caseId`, `(toUserId, status)`.

### case_activities
caseId FK (cascade) · actorId? · type enum (12 values incl. CREATE…REMINDER_DONE) · payload Json?. Index `(caseId, createdAt)`. Append-only.

### work_sessions
caseId FK (cascade) · userId FK (cascade) · startedAt (default now) · endedAt? · durationSeconds? (computed server-side). Indexes `(userId, endedAt)`, `caseId`.

### reminders
caseId FK (cascade) · assigneeId · creatorId · remindAt · status enum (`ACTIVE`/`DONE`/`EXPIRED`) · completedAt?. Index `(assigneeId, status, remindAt)`.

### files
caseId FK (cascade) · uploaderId · filename · storagePath · mimeType · size(int).

### notifications
userId FK (cascade) · type enum (`CASE_ASSIGNED`, `CASE_ACCEPTED`, `CASE_REJECTED`, `REMINDER_DUE`, `CASE_COMPLETED`, `CASE_UPDATED`) · title · body? · linkType/linkId? · readAt?. Index `(userId, readAt, createdAt)`.

## Cascade Behaviour

- Deleting a Company does **not** cascade to Cases in the schema (FK restricts); the test cleanup deletes cases explicitly first.
- Membership/User and Case children (assignments, activities, sessions, reminders, files) cascade on delete.
