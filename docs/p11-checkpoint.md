# P11 checkpoint: System Admin provider configuration

## Status

P11-A, P11-B, P11-C and P11-D are implemented in the repository. No database migration was edited or executed, no deployment was performed, no webhook was registered, and no live Telegram/Bale message was sent by this change set.

## Commit sequence

- P11-A: `8f12f8a6f0f7030a520a3d728d6fc4fbb2a6551f`
- P11-B: `69a94cabd77ed10b2f5f3defdd7a3a8f7d450073`
- P11-C provider configuration/runtime: `ed311873f92f8208ecd1a17020bbb1f3443122f0`
- P11-C compatibility and notification routing: `b6fecb9c850f1e0502e0cab468e9a6376b3e30b2`, `26097a7235efac8d825f5c48e749303d6fdd9a0e`, `da4fcee16a77e4166e669be6bed68c13412adfe5`, `21bb82d09bfd1c71e98ba44543d7df51a480f10d`
- P11-D tests/UI/config: `2f2701483d52757607a84c5ce9d20966d9e06b51`, `c596846cdb06bf8144987e817021e90a2c69b0eb`, `f641549e2871bf2d6d0f9d91ee1e2c4ac4c7b2a2`
- OTP test fixture correction: `864dea9980b8f4796c001b41d5d9fee23bd0d429`

## Delivered

- P11-A: additive encrypted provider configuration foundation, AES-256-GCM credential protection, masking, repository and service layers.
- P11-B: System Admin provider settings API at `/admin/messaging-settings`, exact Telegram/Bale validation, notification multi-select, OTP single-select, disabled-channel protection, encrypted persistence, and redacted reads.
- P11-C: runtime provider resolution from `MessagingSystemPolicy`; credentials are decrypted only in memory for the network request; OTP and notification delivery use DB policy and encrypted credentials; the worker consumes the delivery ledger and revalidates policy and identity snapshots.
- P11-D: existing RTL `MessagingSettings` UI remains the surface for provider cards, enablement, notification toggles, OTP selection, token input, and masked configured state. Direct P11 settings tests and the updated OTP policy fixture were added.
- OTP bootstrap is compatibility-safe: legacy fallback is used only when no DB provider policy exists; once DB policy rows exist, OTP-off or ambiguous policy fails closed.

## Files changed across P11

- `apps/api/prisma/schema.prisma` and `apps/api/prisma/migrations/20260915170000_add_provider_configuration/migration.sql` were introduced by P11-A and remain additive. They were not edited in later P11 commits.
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
- `apps/api/tests/multi-channel-otp.test.ts`
- `.env.example`, `.env.prod.example`, and `docker-compose.prod.yml`

## Security

Raw provider tokens are not returned by API responses, UI reads, or application logs by design. Stored credentials use AES-256-GCM with a random IV and authenticated tag; the master key remains an environment/deployment secret and is not stored in the database. Linking-only webhook variables remain separate from DB-managed delivery credentials.

## Verification

- PASS: TypeScript syntax checks for the proposed P11 source and test files with `node --experimental-strip-types --check`.
- NOT RUN: API/Web builds, typecheck, Vitest, Prisma generate/validate/migrate, isolated PostgreSQL integration tests, live provider sends, deployment, manual owner acceptance, and rollback exercise. These require the project checkout, dependencies, generated Prisma client, and isolated services.
- The OTP fixture was updated to provide the new DB policy `count`/`findMany` mocks; the full suite still needs to run in CI or a complete checkout.

## Rollback

Stop the notification worker and prevent new provider traffic if a controlled stop is required. Revert the P11 code commits in reverse order, or deploy the pre-P11 code SHA. Keep the additive P11 schema, encrypted values, and old migrations; do not drop tables/columns or perform a destructive database rollback. Preserve `MESSAGING_CREDENTIALS_KEY` while encrypted values are retained. Previously sent external messages cannot be recalled.

P11 is complete in the repository. No P12 or other phase was started.
