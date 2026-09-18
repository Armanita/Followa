# Followa Deployment Guide

## 1. Prerequisites

| Component | Version |
|---|---|
| Node.js | ≥ 20 |
| pnpm | ≥ 9 (`corepack enable`) |
| Docker + Compose | any recent (for PostgreSQL) |
| Flutter SDK (mobile only) | 3.47.x, Android toolchain |

## 2. Environment

```bash
cp .env.example .env    # then edit values
```

Required variables:

- `DATABASE_URL` — PostgreSQL connection string (host port is **5433** in the bundled compose file)
- `JWT_SECRET` — **replace** with `openssl rand -hex 32` output
- `SYSTEM_ADMIN_USERNAME` / `SYSTEM_ADMIN_PASSWORD` — seed credentials for the platform admin
- `MESSAGING_CREDENTIALS_KEY` — AES-GCM master key (≥32 chars) for `MessagingSystemPolicy` provider tokens
- `MessagingSystemPolicy` — provider tokens and `enabled`/`otpEnabled`/`notificationEnabled` are configured via System Admin UI (`/admin/messaging-settings`), not ENV
- `STORAGE_DIR`, `MAX_FILE_SIZE_MB` — file storage
- Web: set `NEXT_PUBLIC_API_BASE=https://api.example.com/api/v1` when the API is not same-origin behind one domain

## 3. Local Development

```bash
pnpm install
docker compose up -d          # postgres on 127.0.0.1:5433
pnpm db:migrate               # prisma migrate dev
pnpm db:seed                  # admin + demo company (idempotent)
pnpm dev:api                  # Fastify on :3001
pnpm dev:web                  # Next.js on :3000 (proxies /api → :3001)
```

Demo logins after seeding: admin `admin/admin1234` · manager `09120000001/manager1234` · employees `09120000002..4/employee1234`.

Tests: `pnpm test` (21 tests; requires the database up).

## 4. Production Deployment

> **Docker-based production (recommended):** see `docs/oci-deploy-runbook.md`
> for the full Oracle Cloud / any Linux VM flow.
>
> **Required pre-build step:** `apps/api/Dockerfile` vendors two large Prisma
> packages into the build context to avoid Docker NAT/MTU download failures.
> Run once before `docker compose … build` on any clean clone:
> ```bash
> bash scripts/fetch-pnpm-seed.sh          # Linux / macOS / WSL
> pwsh -File scripts\fetch-pnpm-seed.ps1   # Windows PowerShell
> ```
> Versions and SHA-512 hashes are read from `pnpm-lock.yaml`; a mismatch is a
> hard failure. The script is idempotent — re-running leaves valid files alone.

### Backend
```bash
pnpm install --prod=false
pnpm --filter @followa/api db:deploy     # apply migrations only
pnpm build:api                           # tsc → apps/api/dist
NODE_ENV=production node apps/api/dist/server.js
```
Run behind a reverse proxy with TLS (Caddy/Nginx). Restrict CORS to the web origin. Provide persistent volume for `storage/files/`.

### Database
Managed PostgreSQL or the bundled compose service. Backups: standard `pg_dump` schedule; uploaded files need a filesystem backup too.

### Web
```bash
pnpm build:web
pnpm --filter @followa/web start         # or serve .next behind proxy
```

### Mobile (Android)
```bash
cd apps/mobile
flutter pub get
flutter build apk --release              # signed with debug key by default
# output: build/app/outputs/flutter-apk/app-release.apk
```

**Production signing (required before public distribution):**
1. `keytool -genkey -v -keystore ~/followa-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias followa`
2. Create `apps/mobile/android/key.properties` (gitignored):
   ```
   storePassword=…  keyPassword=…  keyAlias=followa  storeFile=/absolute/path/followa-release.jks
   ```
3. In `android/app/build.gradle.kts` add a `signingConfigs.create("release")` reading those properties and switch `buildTypes.release.signingConfig` to it.
4. Keep the keystore + passwords out of git and backed up safely.

Point the app at the production API at build time:
```bash
flutter build apk --release --dart-define=FOLLOWA_API=https://api.example.com/api/v1
```

## 5. Health & Operations

- `GET /api/v1/health` for uptime checks.
- Logs: pino JSON (pretty in dev). Container logs via `docker logs followa-postgres`.
- Migrations are forward-only; run `db:deploy` on every release.

## 6. Windows Build Note (mobile)

On this machine Gradle needs:
```
JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.20.8-hotspot
TEMP=C:\grtmp   TMP=C:\grtmp   (space-free path — JVM loopback bug)
```
Set both as user environment variables to make `flutter build apk` work from any shell.
