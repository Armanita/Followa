import { describe, expect, it } from 'vitest';
import {
  assertSafeTestDatabaseUrl,
  REFUSAL_MESSAGE,
} from './test-database-safety.js';

describe('test database safety guard', () => {
  it('rejects a production Supabase database URL', () => {
    expect(() => assertSafeTestDatabaseUrl(
      'postgresql://postgres:secret@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?schema=public',
    )).toThrow(REFUSAL_MESSAGE);
  });

  it('allows a local test database URL', () => {
    expect(() => assertSafeTestDatabaseUrl(
      'postgresql://followa:secret@127.0.0.1:5433/followa_test?schema=public',
    )).not.toThrow();
  });

  it('rejects a non-local database unless it is explicitly allowed for tests', () => {
    const remoteTestUrl = 'postgresql://followa:secret@test-db.internal:5432/followa_test?schema=public';

    expect(() => assertSafeTestDatabaseUrl(remoteTestUrl)).toThrow(REFUSAL_MESSAGE);
    expect(() => assertSafeTestDatabaseUrl(remoteTestUrl, {
      allowRemoteTestDatabase: true,
    })).not.toThrow();
  });

  it('does not allow an explicitly remote target marked as production', () => {
    expect(() => assertSafeTestDatabaseUrl(
      'postgresql://followa:secret@database.internal:5432/production?schema=public',
      { allowRemoteTestDatabase: true },
    )).toThrow(REFUSAL_MESSAGE);
  });
});
