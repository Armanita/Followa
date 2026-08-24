# Followa Architecture

Followa is a Persian internal case-management and follow-up system for a single company (~30 users). This document describes the system **as implemented**.

## 1. High-Level Shape

- **Modular monolith** backend, **pnpm monorepo**, **REST API** (`/api/v1`)
- No microservices, Redis, Kubernetes, event bus, or workflow builder (per spec)

```
apps/
  api/      Fastify + TypeScript + Prisma  (port 3001)
  web/      Next.js 15 App Router          (port 3000)
  mobile/   Flutter Android-first
packages/
  shared-types/   TS domain types shared by api/web
  ui/             reserved for future cross-app React primitives
docs/
storage/files/    local file storage root
docker-compose.yml  PostgreSQL 16 only
```

## 2. Backend Modules (`apps/api/src/modules`)

| Module | Responsibility |
|---|---|
| `auth` | admin login, OTP request/verify, password creation, mobile+password login; JWT signing; provider abstraction (mock/sms/bale/eitaa) |
| `admin` | system-admin: create company + first manager (+ default case types), list companies, enable/disable |
| `members` | manager: create/list members, activate/suspend, reset password; profile get/update |
| `companies` | current company info, case types |
| `cases` | case CRUD, result registration, cancel, visibility guards, activity logging |
| `assignments` | transfer / accept / reject(+reason), pending inbox, history read |
| `work-sessions` | start/end sessions with server-side duration, active lists, company overview |
| `reminders` | create, list (status/today/upcoming), complete-with-result, due-check notifications |
| `notifications` | in-app list, mark-read, read-all; push adapter stubs |
| `files` | multipart upload to local disk, authenticated download |
| `dashboard` | manager & employee aggregates, per-employee report |

Shared infrastructure: `plugins/auth.ts` (JWT verify + live membership reload), `lib/errors.ts` (AppError + central error handler), `lib/validation.ts` (zod → Fastify), `lib/prisma.ts`.

## 3. Identity Model

Two independent identities:

- **SystemAdmin** — platform only: creates companies and first managers. No access to company cases/reports.
- **User + CompanyMembership** — role (`COMPANY_MANAGER` | `EMPLOYEE`) lives on the membership, not the user. JWT carries `membershipId`; every request re-loads membership so suspensions/role changes apply immediately.

A user can theoretically belong to multiple companies; the session pins the first active membership.

## 4. Case Lifecycle

```
OPEN ──assign──▶ WAITING_ACCEPTANCE ──accept──▶ IN_PROGRESS ──result(complete)──▶ DONE
                     │                              │
                     └─reject──▶ returns to sender ─┘
any state (except DONE) ──cancel──▶ CANCELLED
```

Exactly one `currentOwnerId` at all times except during WAITING_ACCEPTANCE (ownership is null until accepted).

## 5. Assignment Rules

- Every transfer creates an immutable `CaseAssignment` row (`INITIAL_ASSIGNMENT`, `TRANSFER`, `RETURN_AFTER_REJECT`) with status PENDING → ACCEPTED/REJECTED.
- Reject requires a reason; the case returns to the sender via a synthetic ACCEPTED return assignment.
- History is never deleted or edited (no such endpoints exist).
- Activity timeline is append-only: CREATE, ASSIGN, ACCEPT, REJECT, START_WORK, END_WORK, RESULT_ADDED, FILE_UPLOADED, COMPLETE, CANCEL, REMINDER_CREATED, REMINDER_DONE.

## 6. Visibility Rules

- **Manager**: all company cases.
- **Employee**: cases they own, created, or appear in assignment history of. Enforced in `assertCanViewCase` and mirrored in list queries.

## 7. Web

Next.js 15 App Router, client-side pages under `(app)/` behind a token check, `(auth)/login` + `(auth)/otp`. Persian-only RTL (`<html dir="rtl">`), Vazirmatn font, Jalali dates via `date-fns-jalali`. API access through same-origin Next rewrites to `http://127.0.0.1:3001` in dev.

## 8. Mobile

Flutter 3.47, package `com.followa.followa_mobile`, version 1.0.0+1. Role-aware bottom navigation. Talks directly to the API base URL from `--dart-define=FOLLOWA_API` (default `http://10.0.2.2:3001/api/v1` for emulator).

## 9. File Storage (MVP)

Local disk under `storage/files/<year>/<month>/<caseId>/`, DB record holds filename/storagePath/mimeType/size. Allowlist: PDF, Office docs, images, audio. Max 20 MB. Downloads force `Content-Disposition: attachment`.
