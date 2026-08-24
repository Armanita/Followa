# Followa

سیستم مدیریت پیگیری و گردش کار داخلی شرکت — Persian internal case management & follow-up system.

## Stack

- **API**: Fastify + TypeScript + Prisma + PostgreSQL (modular monolith)
- **Web**: Next.js + TypeScript, Persian RTL, Vazirmatn, Jalali calendar
- **Mobile**: Flutter (Android-first)
- **Infra**: pnpm monorepo, Docker Compose (PostgreSQL only)

## Quick start

```bash
# 1. install
pnpm install

# 2. environment
cp .env.example .env

# 3. database (Docker)
docker compose up -d

# 4. migrate + seed
pnpm db:migrate
pnpm db:seed

# 5. run API (port 3001) and Web (port 3000) in separate terminals
pnpm dev:api
pnpm dev:web
```

Seed creates: system admin (`admin` / `admin1234`), a demo company «شرکت نمونه» with manager `09120000001` / password `manager1234`, employees `09120000002..4` / password `employee1234`.

Mobile app: see `apps/mobile/README.md` (requires Flutter SDK).

## Documentation

- [Architecture](docs/architecture.md) — modules, identity model, lifecycle, visibility rules
- [Database ERD](docs/database-erd.md) — all tables, relations, indexes
- [API contract](docs/api-contract.md) — every endpoint, request/response shapes
- [Deployment](docs/deployment.md) — dev setup, production steps, Android signing
- [Security](docs/security.md) — auth hardening, isolation, known gaps
- [Developer guide](docs/developer-guide.md) — conventions, workflows, sharp edges
- [User guide (فارسی)](docs/user-guide-fa.md) — end-user manual
- [Manual testing guide (فارسی)](docs/manual-testing-guide-fa.md) — راهنمای تست دستی

