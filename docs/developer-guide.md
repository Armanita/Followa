# Followa Developer Guide

## Repository Layout

```
apps/api        Fastify API (TypeScript ESM, Prisma, zod)
apps/web        Next.js 15 App Router (Persian RTL)
apps/mobile     Flutter (Android-first)
packages/shared-types   shared TS domain types
packages/ui             reserved React primitives
docs/           architecture, ERD, API contract, deployment, security
```

## Setup

See [deployment.md](deployment.md) §3. In short: `pnpm install`, `docker compose up -d`, `pnpm db:migrate`, `pnpm db:seed`, then `pnpm dev:api` + `pnpm dev:web`.

## Backend Conventions

- **Modules** under `src/modules/<domain>/`: `*-routes.ts` (HTTP layer), `*-service.ts` (business rules). Cross-module reuse goes through service functions (`assertCanViewCase`, `logActivity`, `notificationService`).
- **Validation**: every body parsed with a zod schema via `parseWith` — never read `request.body` raw.
- **Errors**: throw helpers from `lib/errors.ts` (`badRequest/unauthorized/forbidden/notFound/conflict`); the central handler formats responses. Persian user-facing messages.
- **Auth**: JWT payload → `request.actor`. Guards: role checks inline per module; membership liveness is re-checked in the auth hook on every request.
- **DB**: Prisma only. Transactions (`prisma.$transaction`) for multi-write invariants (assignment + case state + activity).
- **Testing** (`pnpm test`, vitest): tests run against the real database using `app.inject`; fixtures create isolated companies with unique mobiles and clean up by tag. Keep the mandatory scenario green — it encodes the spec's core flow.

### Adding an endpoint checklist
1. zod schema → 2. route in the right module → 3. visibility guard (`assertCanViewCase` or manager check) → 4. service logic + transaction → 5. activity log where it belongs on the timeline → 6. notification where another human must know.

## Web Conventions

- All pages are client components fetching through `lib/api.ts` (`api.get/post/patch`) which attaches the stored JWT; 401 handling relies on route guard redirecting to `/login`.
- Dates: always format through `lib/jalali.ts` (`faDate`, `faDateTime`, `faDuration`) — never raw ISO in UI. Persian digits via `toFa`.
- Labels/statuses come from `lib/labels.ts`; status colors live there too.
- UI primitives in `components/ui.tsx` (Card, StatCard, Modal, badges, Empty/Error/Loading states); timeline/history in `components/timeline.tsx`.
- RTL: layout sets `dir="rtl"` globally; avoid physical CSS directions (use `mr-*`/`ml-*` sparingly, prefer logical spacing).

## Mobile Conventions

- Single API client: `services/auth_service.dart` (`AuthService.instance.get/post/patch`). Base URL from `--dart-define=FOLLOWA_API`.
- Jalali formatting + Persian digits: `Fa.date/dateTime/duration/num` in `widgets/common.dart`.
- Screens are self-contained; keep business calls inside screens minimal and go through AuthService.
- Analyze before commit: `flutter analyze` must show **0 errors**.

## Database Workflow

```bash
# after editing apps/api/prisma/schema.prisma
cd apps/api
npx prisma migrate dev --name <change>
npx prisma format && npx prisma validate
```
Never edit applied migrations; generate a new one. For production apply with `db:deploy`.

## Useful Commands

| Command | Purpose |
|---|---|
| `pnpm build:api` / `pnpm build:web` | production builds |
| `pnpm test` | API suite |
| `pnpm db:studio` | Prisma Studio GUI |
| `docker compose up -d` / `down` | database lifecycle |

## Known Sharp Edges

1. Windows + space in user profile path breaks Gradle's JVM loopback — set `TEMP/TMP=C:\grtmp` when building mobile (see deployment.md §6).
2. `localhost` resolves to IPv6 first here — DB URLs use `127.0.0.1`.
3. pnpm blocks postinstall scripts by default; approved packages are listed in `pnpm-workspace.yaml > allowBuilds`.
