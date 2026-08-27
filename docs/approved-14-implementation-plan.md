# Followa — Approved 14-Item Implementation Plan

Status: APPROVED by product owner
Base commit: `703cc051b41cd4897af95e86f91ba2cbf6cddf63`
Implementation branch: `feat/followa-approved-14-phase1`

## Guardrails

- Keep Company Manager and Employee operational pages role-separated.
- Preserve the already-approved Manager Case Detail behavior unless a specific approved cross-role fix requires a shared low-level component change.
- Persian/RTL UI only; no Gregorian date picker in user-facing flows.
- Preserve company isolation and existing authorization boundaries.
- No secrets, bot tokens, passwords, or production credentials in Git.
- Use the existing modular-monolith/PostgreSQL architecture. No Redis, microservices, Kubernetes, or complex permission engine.
- Railway `main` remains untouched until focused build/tests pass and the change set is reviewed.

## Approved items

### 1. Case timeline result details
Every `RESULT_ADDED` activity must show its own result text in the timeline. Historical result payloads must remain visible even when `Case.result` is overwritten by the latest result.

### 2. Employee authenticated file viewing/download
Employee case attachments must never use a raw direct protected URL. Viewing/downloading must send the JWT through the authenticated API helper and surface Persian friendly errors instead of raw `401` JSON.

### 3. Result + next reminder as one employee workflow
The primary employee flow is `ثبت نتیجه`. If work remains, the same form can optionally create the next reminder. Reminder date selection must be Jalali in the UI. The standalone reminder action should be removed from the primary employee case action bar once the integrated flow is available.

### 4. Replace manual Start/Stop with self-reported effort
Remove Start/Stop from the primary employee case workflow. The result form records optional/required effort for that work entry (minutes). Treat it as self-reported effort, not an exact timer. Historical WorkSession data remains readable; no destructive rewrite.

### 5. Jalali employee birth date
Employee profile birth-date input must be Jalali in the UI while the backend/database keep a standard DateTime representation.

### 6. Finalize-and-lock employee profile
Employee may complete and save profile information until an explicit `ثبت نهایی اطلاعات` action. After finalization, employee profile edits are rejected by the backend, not merely disabled in the UI. Subsequent personnel-data edits are Manager-only.

### 7. Personnel photo
Add authenticated personnel-photo storage/display. Employee may upload during initial profile completion; after finalization only Manager can replace it. Restrict MIME/size and store file metadata/path, not binary data in PostgreSQL.

### 8. Customer module and Case → Customer relation
Add company-scoped Customer records. Customer can be individual or legal entity. Case gets optional `customerId` so internal cases remain possible. Case creation supports customer search/select and controlled quick-create. Customer history must support future customer-centric reporting.

### 9. Real Bale delivery + reliable notification engine
Bale becomes a delivery adapter, not business logic. Notification events are persisted first. Add reliable delivery state/retry using PostgreSQL and a lightweight worker/scheduler. Required events include assignment, acceptance/rejection where relevant, due reminders, case completion, and manager visibility of meaningful employee case updates. No bot token in Git.

### 10. Sensitive-data audit log
Record who changed sensitive personnel/customer data, when, entity, operation, and a safe field-level change summary. Do not log secrets or raw credentials.

### 11. Archive/inactive policy instead of destructive delete
Personnel, customers, and cases with history should be deactivated/archived rather than physically deleted in normal product flows. Historical references must remain stable.

### 12. Unified date/time policy
All UI dates are Jalali. Backend/database store standard timestamps. Company/application timezone behavior must be explicit and shared by reminders, reports, and daily boundaries.

### 13. Backup and restore
Document and implement a production backup strategy for PostgreSQL plus file/personnel-photo storage, and document a restore drill. A backup is not considered sufficient without a tested restore procedure.

### 14. Security hardening before real personnel data
At minimum: password-login throttling/rate limiting, remove production dependence on in-memory OTP/pending setup state, production-secret rotation procedure, and stronger uploaded-file validation/content checks where practical for the MVP.

## Execution order

### Phase A — Case work-entry UX hardening (no schema migration)
Items 1–4.

Acceptance:
- historical result text visible per timeline entry;
- employee attachment view/download authenticated;
- result form optionally creates a next reminder with Jalali UI;
- Start/Stop removed from the primary employee workflow;
- effort minutes stored with the result activity payload;
- Manager page behavior not regressed.

### Phase B — Personnel data governance
Items 5–7 and audit portions of item 10.

Expected schema work:
- profile-finalization state/time;
- personnel photo metadata/reference;
- audit records as required.

### Phase C — Customer domain foundation
Item 8 plus relevant parts of items 10–12.

Expected schema work:
- `Customer` model;
- optional `Case.customerId`;
- company-scoped uniqueness/indexing decisions;
- archive/inactive fields.

### Phase D — Notification/Bale reliability
Item 9 and reminder escalation behavior.

Expected work:
- real Bale adapter;
- user/chat binding flow;
- persisted delivery attempts/state;
- scheduler/worker entry point;
- retry/idempotency controls;
- manager notification event rules.

### Phase E — Production hardening
Items 11–14 across the remaining modules and deployment docs.

## Testing gates

Each phase must pass its focused gates before merge:

- TypeScript/build for changed packages.
- Relevant backend tests.
- Authorization/company-isolation tests for any new data model/API.
- Migration status/validation for schema phases.
- Focused browser/manual acceptance for the affected role.
- No raw secrets in diff.

A successful build alone is not acceptance.
