import { pathToFileURL } from 'node:url';
import { config } from '../src/config.js';
import { prisma } from '../src/lib/prisma.js';
import {
  createMessagingRepository,
  type LegacyTelegramIdentityInput,
  type LegacyTelegramImportResult,
} from '../src/modules/messaging/messaging-repository.js';

type BackfillMode = 'dry-run' | 'apply';

type LegacyRow = LegacyTelegramIdentityInput;

type BackfillRepository = {
  inspectLegacyTelegramIdentity(
    input: LegacyRow,
  ): Promise<LegacyTelegramImportResult>;
  importLegacyTelegramIdentity(
    input: LegacyRow,
  ): Promise<LegacyTelegramImportResult>;
};

export type MessagingBackfillResult = {
  mode: BackfillMode;
  scanned: number;
  wouldCreate: number;
  created: number;
  alreadySynced: number;
  conflicts: number;
  conflictLegacyIds: string[];
  checkpoint: string | null;
  stoppedAt: string | null;
};

export async function runMessagingIdentityBackfill(input: {
  mode: BackfillMode;
  batchSize: number;
  after?: string;
  readBatch(after: string | undefined, take: number): Promise<LegacyRow[]>;
  repository: BackfillRepository;
  onBatch?: (result: MessagingBackfillResult) => void;
}): Promise<MessagingBackfillResult> {
  if (!Number.isInteger(input.batchSize) || input.batchSize < 1 || input.batchSize > 1000) {
    throw new Error('messaging_backfill_invalid_batch_size');
  }

  const result: MessagingBackfillResult = {
    mode: input.mode,
    scanned: 0,
    wouldCreate: 0,
    created: 0,
    alreadySynced: 0,
    conflicts: 0,
    conflictLegacyIds: [],
    checkpoint: input.after ?? null,
    stoppedAt: null,
  };
  let cursor = input.after;

  for (;;) {
    const rows = await input.readBatch(cursor, input.batchSize);
    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const outcome =
        input.mode === 'apply'
          ? await input.repository.importLegacyTelegramIdentity(row)
          : await input.repository.inspectLegacyTelegramIdentity(row);

      result.scanned += 1;
      if (outcome.status === 'would_create') result.wouldCreate += 1;
      if (outcome.status === 'created') result.created += 1;
      if (outcome.status === 'already_synced') result.alreadySynced += 1;
      if (outcome.status === 'conflict') {
        result.conflicts += 1;
        result.conflictLegacyIds.push(row.legacyIdentityId);
        if (input.mode === 'apply') {
          result.stoppedAt = row.legacyIdentityId;
          input.onBatch?.({ ...result });
          return result;
        }
      }

      cursor = row.legacyIdentityId;
      result.checkpoint = cursor;
    }

    input.onBatch?.({ ...result });
    if (rows.length < input.batchSize) {
      break;
    }
  }

  return result;
}

function argumentValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

async function runCli(): Promise<void> {
  const mode: BackfillMode = process.argv.includes('--apply') ? 'apply' : 'dry-run';
  if (mode === 'apply' && !config.messagingIdentityBackfillEnabled) {
    throw new Error('messaging_backfill_apply_disabled');
  }

  const batchSize = Number(argumentValue('batch-size') ?? '100');
  const after = argumentValue('after');
  const repository = createMessagingRepository(prisma);

  const result = await runMessagingIdentityBackfill({
    mode,
    batchSize,
    after,
    repository,
    readBatch: async (cursor, take) => {
      const rows = await prisma.telegramIdentity.findMany({
        take,
        orderBy: { id: 'asc' },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          userId: true,
          telegramUserId: true,
        },
      });
      return rows.map((row) => ({
        legacyIdentityId: row.id,
        userId: row.userId,
        telegramUserId: row.telegramUserId,
      }));
    },
    onBatch: (progress) => {
      // Internal legacy IDs are logged only as resumable checkpoints/conflicts.
      // User IDs and Telegram IDs are deliberately excluded.
      console.log(JSON.stringify({
        event: 'messaging_identity_backfill_batch',
        ...progress,
      }));
    },
  });

  console.log(JSON.stringify({
    event: 'messaging_identity_backfill_complete',
    ...result,
  }));

  if (result.conflicts > 0) {
    process.exitCode = 2;
  }
}

const directRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (directRun) {
  runCli()
    .catch((error) => {
      console.error(
        '[messaging-backfill] failed',
        error instanceof Error ? error.message : 'unknown_error',
      );
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
