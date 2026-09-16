# P11 checkpoint: System Admin provider configuration

## Status

P11-A, P11-B, P11-C and P11-D are implemented in the repository. No database migration was edited or executed, no deployment was performed, no webhook was registered, and no live Telegram/Bale message was sent by this change set.

## Delivered

- P11-A: additive encrypted provider configuration foundation, AES-256-GCM credential protection, masking, repository and service layers.
- P11-B: System Admin provider settings API at `/admin/messaging-settings`, exact Telegram/Bale validation, notification multi-select, OTP single-select, disabled-channel protection, encrypted persistence, and redacted reads.
- P11-C: runtime provider resolution from `MessagingSystemPolicy`; credentials are decrypted only in memory for the network request; OTP and notification delivery do not use provider tokens from environment variables; delivery worker consumes the DB ledger and revalidates policy and identity snapshots.
- P11-D: existing RTL `MessagingSettings` UI remains the surface for provider cards, enablement, notification toggles, OTP selection, token input, and masked configured state. Direct P11 settings tests were added.

## Files changed across P11

- `apps/api/prisma/schema.prisma` and `apps/api/prisma/migrations/20260915170000_add_provider_configuration/migration.sql` were introduced by P11-A and remain additive. They were not changed by P11-B/C/D.
- `apps/api/src/modules/messaging/provider-configuration.ts`
- `apps/api/src/modules/messaging/provider-credentials.ts`
- `apps/api/src/modules/messaging/provider-config-repository.ts`
- `apps/api/src/modules/messaging/provider-config-service.ts`
- `apps/api/src/modules/messaging/provider-policy-validation.ts`
- `apps/api/src/modules/messaging/db-backed-provider.ts`
- `apps/api/src/modules/messaging/otp-dispatcher.ts`
- `apps/api/src/modules/messaging/notification-dispatcher.ts`
- `apps/api/src/modules/messaging/delivery-worker.ts`
- `apps/api/src/modules/auth/otp-providers.ts`
- `apps/api/src/modules/notifications/notification-service.ts`
- `apps/api/src/modules/telegram/telegram-client.ts`
- `apps/api/src/modules/bale/bale-client.ts`
- `apps/api/tests/provider-configuration.test.ts`
- `apps/api/tests/p11-provider-settings.test.ts`
- `.env.example`, `.env.prod.example`, and `docker-compose.prod.yml` retain only `MESSAGING_CREDENTIALS_KEY` as the provider-delivery secret; linking-only bot variables remain separate.

## Security

Raw provider tokens are not returned by API responses, UI reads, or application logs by design. Stored credentials use AES-256-GCM with a random IV and authenticated tag; the master key remains an environment/deployment secret and is not stored in the database.

## Verification

- PASS: TypeScript syntax checks for the P11 source and test files with `node --experimental-strip-types --check`.
- NOT RUN: API/Web builds, typecheck, Vitest, Prisma generate/validate/migrate, isolated PostgreSQL integration tests, live provider sends, deployment, manual owner acceptance, and rollback exercise. These require the project checkout, dependencies, generated Prisma client, and isolated services.

## Rollback

Stop the notification worker and prevent new provider traffic if a controlled stop is required. Revert the P11 code commits in reverse order, or deploy the pre-P11 code SHA. Keep the additive P11 schema, encrypted values, and old migrations; do not drop tables/columns or perform a destructive database rollback. Preserve `MESSAGING_CREDENTIALS_KEY` while encrypted values are retained. Previously sent external messages cannot be recalled.

P11 is complete in the repository. No P12 or other phase was started.
