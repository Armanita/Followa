# Followa Security Notes

## Authentication
- Passwords: bcrypt, cost 10 (12 for admin seed). Never returned by any endpoint (`passwordHash` stripped in profile responses).
- JWT (HS256 via @fastify/jwt): company sessions 12h, admin sessions 8h. Secret from `JWT_SECRET` env — **must** be replaced with a long random value outside development.
- OTP: 6-digit code, 5-minute TTL, max 5 wrong attempts, single outstanding code per mobile. Mock provider logs the code; real SMS/Bale/Eitaa adapters share the same interface.
- Password setup after OTP requires a one-time `resetToken` bound to the user and consumed on use.

## Authorization & Isolation
- Every authenticated request re-loads the CompanyMembership: suspension or role change takes effect on the next request without waiting for token expiry.
- Role checks are enforced server-side in each module (manager-only endpoints return 403 for employees).
- Company isolation: every case/reminder/file query is scoped by `companyId`; cross-company access returns 404 (indistinguishable from missing).
- Employee visibility limited to owned + created + participated cases (`assertCanViewCase`); write access additionally restricted to the current owner.
- Assignment history and activity timeline have no update/delete endpoints — immutability is structural.

## Input Validation
- zod schemas parse every request body; failures → 400 with field path.
- Mobile numbers normalised (Persian digits, +98/0098 forms) before lookup.
- File uploads: MIME allowlist (PDF/Office/images/audio), streamed size cap 20 MB with temp-file cleanup, server-generated random filenames (no user-controlled path components), download forces `Content-Disposition: attachment` (no inline HTML execution).

## Transport & Runtime
- Development uses cleartext HTTP locally; production must terminate TLS at a reverse proxy (see deployment.md).
- CORS currently open (`origin: true`) for dev convenience — restrict to the web origin in production.
- Rate limiting: only OTP has attempt limits; add login throttling / IP backoff before public exposure.

## Secrets Hygiene
- `.env` is gitignored; `.env.example` documents required variables without real credentials.
- No secrets or machine-specific paths exist in committed source (verified by grep audit).
- Uploaded files live under `storage/files/`, also gitignored.

## Known Gaps (accepted for MVP)
1. No content-sniffing of uploaded files (client-declared MIME trusted within allowlist).
2. No global rate limiter on `/auth/login`.
3. Reminder completion can set a DONE case back to IN_PROGRESS when called with a result (edge case documented in audit).
4. In-memory OTP/pending-setup stores reset on API restart.
