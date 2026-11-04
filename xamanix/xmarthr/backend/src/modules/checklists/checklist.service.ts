import { prisma } from '../../core/prisma';
import type { ChecklistType } from '@prisma/client';

/**
 * Instantiate a checklist for an employee from the org's template of that type.
 * Best-effort — never throws, so it can't break employee create/terminate.
 */
export async function createChecklistFromTemplate(employeeId: string, orgId: string, type: ChecklistType): Promise<void> {
  try {
    const template = await prisma.checklistTemplate.findFirst({ where: { orgId, type } });
    const titles = (template?.items as string[] | undefined) ?? [];
    if (!template && titles.length === 0) return; // no template → nothing to do
    const items = titles.map((t) => ({ title: t, done: false }));
    await prisma.checklist.create({ data: { employeeId, type, title: template?.name ?? `${type} checklist`, items } });
  } catch (err) {
    console.error('[checklist] auto-create failed', err);
  }
}
