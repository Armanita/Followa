# Followa API Contract

Base URL: `/api/v1` · JSON · JWT Bearer auth (`Authorization: Bearer <token>`) unless marked **public**.
Errors: `{ statusCode, code, message }` — Persian `message`, stable machine codes (`BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `VALIDATION_ERROR`).

## Auth (public)

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/auth/admin/login` | `{username, password}` | `{token, admin:{id,username}}` |
| POST | `/auth/login` | `{mobile, password}` | `{token, user:{id, mobile, firstName, lastName, fullName, role, companyId}}` |
| POST | `/auth/otp/request` | `{mobile}` | `{message, isNewUser}` (mock provider logs code) |
| POST | `/auth/otp/verify` | `{mobile, code}` | `{resetToken}` |
| POST | `/auth/password` | `{mobile, resetToken, password}` | `{message}` |

Mobile normalisation accepts `09…`, `+98…`, `0098…`, Persian digits.

## System Admin (admin JWT)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/companies` | list with managers/counts |
| POST | `/admin/companies` | `{name, manager:{firstName,lastName,mobile,password,jobTitle?}}` → creates company + 4 default case types + manager membership |
| PATCH | `/admin/companies/:id/active` | `{isActive}` |
| GET | `/admin/stats` | counts |

## Members / Profile (company JWT)

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/members` | manager | all company members with `hasPassword`, `isActive` |
| POST | `/members` | manager | create member; optional initial `password`; else `requiresOtpSignup:true` |
| PATCH | `/members/:membershipId` | manager | `{isActive?, jobTitle?, employeeCode?}`; self-suspend blocked |
| POST | `/members/:membershipId/reset-password` | manager | `{newPassword}` |
| GET/PATCH | `/profile` | any active | profile incl. bank fields |

## Cases

| Method | Path | Notes |
|---|---|---|
| GET | `/cases?search&status&priority&archive=active|archived&customerId&caseTypeId&ownerId&from&to&mine=true&page&pageSize&sort=dueDate` | visibility-filtered, paginated `{items,total,page,pageSize}`; `archive` splits active (`OPEN/WAITING_ACCEPTANCE/IN_PROGRESS/WAITING_APPROVAL`) vs archived (`DONE/CANCELLED`); `from`/`to` filter `createdAt` (date-only or ISO) |
| POST | `/cases` | `{title, description?, caseTypeId?, priority?, dueDate?(ISO), assignToUserId?, assignNote?}` → assign puts case in WAITING_ACCEPTANCE |
| GET | `/cases/:id` | detail + files + workSessions + reminders + `canEdit` + `hasPendingAcceptanceForMe` + `totalWorkSeconds` |
| PATCH | `/cases/:id` | edit fields (manager or current owner) |
| POST | `/cases/:id/result` | `{result, complete:boolean}` → RESULT_ADDED (+COMPLETE → DONE) |
| POST | `/cases/:id/cancel` | manager or creator, not when DONE |
| GET | `/cases/:id/activities` | timeline asc with actor |
| GET | `/cases/:id/assignments` | full immutable history |
| POST | `/cases/:id/files` | multipart field `file`; allowlist PDF/Office/image/audio; max 20MB → 201 `{file}` |
| GET | `/files/:fileId/download` | visibility-checked attachment stream |

## Assignments / Work Sessions

| Method | Path | Notes |
|---|---|---|
| GET | `/assignments/pending` | my PENDING assignments in WAITING_ACCEPTANCE cases |
| POST | `/cases/:id/transfer` | `{toUserId, note?}` — owner or manager; clears currentOwner |
| POST | `/cases/:id/accept` | receiver only; case → IN_PROGRESS owned by acceptor |
| POST | `/cases/:id/reject` | `{reason}` mandatory; returns to sender |
| POST | `/work-sessions/start` | `{caseId}`; parallel cases OK; duplicate on same case → 409 |
| POST | `/work-sessions/end` | `{caseId}` → server-computed durationSeconds |
| GET | `/work-sessions/active` | my open sessions |
| GET | `/work-sessions/company-active` | manager: everyone working now |
| GET | `/cases/:id/work-sessions` | session history for case |
| GET | `/work-sessions/my-summary` | today's seconds |

## Reminders

| Method | Path | Notes |
|---|---|---|
| POST | `/reminders` | `{caseId, remindAt(ISO with Z), note?}`; future-only; closed cases rejected |
| GET | `/reminders?status=ACTIVE\|DONE\|EXPIRED&today=true&upcoming=true` | my reminders with case info |
| POST | `/reminders/:id/complete` | `{result?}` → DONE (+writes case result, stays IN_PROGRESS); idempotence-guarded |
| GET | `/reminders/due-check` | idempotent via atomic `Reminder.notifiedAt` claim; `{dueCount, notifiedCount}`; primary source of truth is `reminder-due-worker` |

Reminder due notifications are produced by the dedicated `reminder-due-worker` process (`apps/api/src/modules/reminders/reminder-due-worker.ts`), which polls every `REMINDER_DUE_WORKER_POLL_MS` (default 15000), claims due rows with `notifiedAt IS NULL`, enqueues `REMINDER_DUE`, and expires rows older than `REMINDER_DUE_MAX_AGE_HOURS` (default 24) without notifying. Env: `REMINDER_DUE_WORKER_POLL_MS`, `REMINDER_DUE_WORKER_BATCH_SIZE`, `REMINDER_DUE_MAX_AGE_HOURS`.

## Notifications

GET `/notifications?unread=true&limit=` → `{items, unreadCount}` · each item includes `caseId` (resolved for `linkType=REMINDER`) for deep-linking ·
POST `/notifications/:id/read` · POST `/notifications/read-all`

## Dashboards

- GET `/dashboard/manager` — cards (total/open/waitingAcceptance/inProgress/done/cancelled/late/activeEmployees), urgentCases[≤8], recentActivities[15], activeWorkers, statusChart
- GET `/dashboard/employee` — cards (myCases/todayReminders/newAssignments/activeWork/completedCases), remindersToday, activeWork, recentActivities[10]
- GET `/reports/employees` — per-member 30-day stats (ownedActive, completed, workSeconds30d, sessions30d, pendingAssignments)

## Companies

- GET `/companies/current` — name + active case types
- POST `/case-types` — manager only, `{name, color?}`

## Health

GET `/health` (public) → `{status:'ok', time}`
