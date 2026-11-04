import { prisma } from './prisma';

export const writeAudit = async (entry: {
  orgId?: string | null;
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        orgId: entry.orgId ?? null,
        actorId: entry.actorId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        metadata: (entry.metadata as any) ?? undefined,
      },
    });
  } catch (err) {
    console.error('[audit] failed to write', err);
  }
};
