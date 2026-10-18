# Mobile case UX redesign

## Scope and contracts

The redesign is confined to Flutter. Backend contracts, reminder scheduling,
Telegram/Bale behavior, immutable records and archive semantics are unchanged.
The known timezone **display** issue is deliberately unchanged. Result reminders
still use the existing UTC serialization and the existing Jalali parser.

Case home now prioritizes identity, status/responsibility, latest result and next
reminder. Description and secondary metadata use progressive disclosure. Full
history, responsibility records, documents and transfer have separate screens.
Employee execution, pending-assignment decisions and manager transfer actions
live in a persistent safe-area footer. A manager never receives the employee
result composer or employee upload action.

`CaseRepository` is an injectable adapter over the existing authenticated service;
`CaseAccess` mirrors actual ownership/role constraints rather than trusting the
API's currently broad `canTransfer` flag by itself. The server remains authoritative.

## Result entry and recovery

Result drafts are memory-only, keyed by signed-in user ID and case ID. Text,
effort, completion choice and scheduling values survive failed validation and
requests. Back offers continue, keep or discard. Confirmed success and logout
clear drafts. They do not survive process termination or synchronize devices.

Result submission retains the existing `result`, `effortMinutes`, `complete`
and optional `nextReminder` fields. Completion omits `nextReminder` without
erasing its draft values. Saving a result still completes the acting user's
active reminders for the case; the form states that consequence explicitly.

An uncertain result POST is never automatically repeated. The user can inspect
history, confirm that it was recorded, or explicitly allow another attempt.
The existing API has no idempotency key, so the client cannot guarantee exactly
once submission after a lost response. A successful POST followed by a failed
refresh is reported as saved, with a separate display-refresh error.

Reminder-only completion remains a different operation. It accepts an optional,
initially empty outcome, sends only that optional result to the existing reminder
endpoint, adds no effort or next reminder, and does not complete the case. A
personal active reminder remains completable after ownership changes, as allowed
by the existing API. Closed-case reminders preserve the existing backend behavior.

## History and data limits

Activity filters only select presentation; they do not mutate or deduplicate
records. Every result uses its own event payload, and reminder-result events are
labeled distinctly. Responsibility history retains every assignment, including
return-after-rejection rows, with explicit sender/recipient/status/reason.
Unknown and legacy payload fields remain accessible in event details.

The case response has customer identity, not complete employee-visible customer
contact details. No contact data is fabricated. Manager customer history uses the
existing manager endpoint. Latest-result authorship is shown only when an event
can be reliably matched to the latest text and timestamp; otherwise only the
available timestamp is shown. Completion/cancellation time comes from an event,
not the last-result timestamp.

Documents preserve authenticated download, file/gallery selection, camera capture,
preview/retake and upload. Transfer progress is indeterminate because the existing
HTTP helper does not expose byte progress. Pending upload bytes remain in memory
for retry. Non-image documents retain the platform save-file behavior; an embedded
Office/PDF viewer is not added.

History requests currently return the entire record. The UI lazily renders rows;
server-side pagination is not introduced. Selecting a recent event highlights it
above the full history instead of relying on a pixel offset into variable-height
Persian text.

## Navigation

Employee Cases offers current responsibility (`mine=true`) and already-authorized
related cases (omit `mine`). Active/archive and status filters retain their meaning.
Dashboard work rows, notification targets, customer-report cases and newly created
cases open the appropriate case/reminder context. Subflows use pushed full pages
without the global bottom bar. Workspace tabs retain their state and refresh on
return.

## Manual APK acceptance checklist

- Test a small Android display with normal and enlarged font sizes.
- Open long Persian titles, descriptions, results and employee/customer names.
- Check owner, pending recipient, historical viewer, manager, unassigned manager,
  completed and cancelled states; verify action eligibility in each.
- Check no result, no documents, no active reminders and multiple active reminders.
- Scroll a long case and verify the primary action remains reachable.
- Write with the keyboard open; verify fields/errors and submit remain reachable.
- Enter Persian/Arabic effort digits; test all length/range errors without losing text.
- Toggle scheduling off/on and complete/continue; verify retained scheduling values.
- Keep, resume and discard a draft; log out and verify it is cleared.
- Submit twice quickly; verify only one in-flight request.
- Simulate definite failure, timeout, ownership change and success followed by a
  failed refresh; verify recovery and no automatic duplicate POST.
- Enter a result from a reminder; separately complete only a personal reminder.
- Transfer a case, inspect the new pending state, then rediscover it in related cases.
- Reject with invalid input and API failure; verify reason retention and actual
  server-reported return/fallback behavior.
- Browse all history filters, unknown/legacy events and every assignment record.
- Exercise file/gallery selection, camera permission denial, preview, retake,
  upload failure/retry, authenticated image viewing and non-image saving on device.
- Verify list filters/scroll positions after visiting cases, subflows and other tabs.
- Open cases from dashboard, assignments, reminders, notifications, reports,
  customer history and successful creation.
- Verify timezone display matches the existing behavior; its correction is a
  separately scoped task, not an acceptance claim for this redesign.
