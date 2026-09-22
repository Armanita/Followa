import 'dotenv/config';
import { assertSafeTestDatabaseUrl } from './test-database-safety.js';

export default function globalTestSetup(): void {
  assertSafeTestDatabaseUrl(process.env.DATABASE_URL, {
    allowRemoteTestDatabase: process.env.FOLLOWA_ALLOW_REMOTE_TEST_DATABASE === 'true',
  });
}
