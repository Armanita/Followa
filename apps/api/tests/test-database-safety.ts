const REFUSAL_MESSAGE =
  'Refusing to run tests against production database. Configure a dedicated test database.';

const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const TEST_TARGET_MARKER = /(^|[._-])(test|testing|ci)([._-]|$)/iu;
const PRODUCTION_TARGET_MARKER = /(^|[._-])(prod|production)([._-]|$)/iu;

export interface TestDatabaseSafetyOptions {
  allowRemoteTestDatabase?: boolean;
}

function refuse(): never {
  throw new Error(REFUSAL_MESSAGE);
}

export function assertSafeTestDatabaseUrl(
  databaseUrl: string | undefined,
  options: TestDatabaseSafetyOptions = {},
): void {
  if (!databaseUrl?.trim()) refuse();

  let target: URL;
  try {
    target = new URL(databaseUrl);
  } catch {
    refuse();
  }

  if (target.protocol !== 'postgres:' && target.protocol !== 'postgresql:') refuse();

  const hostname = target.hostname.toLowerCase();
  const databaseName = decodeURIComponent(target.pathname.replace(/^\//u, ''));
  const schemaName = target.searchParams.get('schema') ?? '';
  const targetParts = [hostname, databaseName, schemaName];

  if (
    hostname === 'supabase.com'
    || hostname.endsWith('.supabase.com')
    || hostname === 'supabase.co'
    || hostname.endsWith('.supabase.co')
    || targetParts.some((part) => PRODUCTION_TARGET_MARKER.test(part))
  ) {
    refuse();
  }

  if (LOCAL_DATABASE_HOSTS.has(hostname)) return;

  if (
    options.allowRemoteTestDatabase === true
    && targetParts.some((part) => TEST_TARGET_MARKER.test(part))
  ) {
    return;
  }

  refuse();
}

export { REFUSAL_MESSAGE };
