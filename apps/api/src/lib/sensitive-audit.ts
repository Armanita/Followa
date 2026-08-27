import { prisma } from './prisma.js';

export async function recordSensitiveAudit(input: {
  companyId: string;
  actorId: string;
  entityType: 'USER_PROFILE' | 'CUSTOMER';
  entityId: string;
  action: string;
  changedFields?: string[];
}): Promise<void> {
  await prisma.sensitiveAuditLog.create({
    data: {
      companyId: input.companyId,
      actorId: input.actorId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      changes:
        input.changedFields && input.changedFields.length > 0
          ? { fields: [...new Set(input.changedFields)].sort() }
          : undefined,
    },
  });
}

export function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  keys: string[],
): string[] {
  return keys.filter((key) => {
    const left = before[key];
    const right = after[key];
    if (left instanceof Date || right instanceof Date) {
      const l = left instanceof Date ? left.getTime() : left;
      const r = right instanceof Date ? right.getTime() : right;
      return l !== r;
    }
    return left !== right;
  });
}
