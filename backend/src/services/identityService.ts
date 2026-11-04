import { supabaseAdmin } from '../lib/supabase';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';

export type ProvisionedIdentity = { providerId?: string; temporaryPassword?: string; existingProviderAccount: boolean };

/** Provider creation is compensated if the atomic application write fails. Verified existing
 * provider accounts are reusable after a partial failure, and their passwords are never reset. */
export async function withProvisionedIdentity<T>(email: string, temporaryPassword: string,
  persist: (identity: ProvisionedIdentity) => Promise<T>): Promise<T> {
  if (!supabaseAdmin) {
    if (!env.enableDemoAuth) throw new Error('Account provisioning requires configured Supabase administrator credentials');
    return persist({ temporaryPassword, existingProviderAccount: false });
  }
  const normalized = email.trim().toLowerCase();
  const created = await supabaseAdmin.auth.admin.createUser({ email: normalized, password: temporaryPassword, email_confirm: true });
  let providerId = created.data.user?.id;
  const isNew = !!providerId && !created.error;
  if (!providerId || created.error) {
    // A previous attempt may have created the provider identity before the DB transaction failed.
    if (!/already|exist|registered/i.test(created.error?.message ?? '')) throw new Error(created.error?.message ?? 'Provider provisioning failed');
    for (let page = 1; page <= 100; page++) {
      const listed = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (listed.error) throw new Error('Could not resolve existing provider account');
      const found = listed.data.users.find(user => user.email?.toLowerCase() === normalized && user.email_confirmed_at);
      if (found) { providerId = found.id; break; }
      if (listed.data.users.length < 1000) break;
    }
    if (!providerId) throw new Error('Existing provider account must verify its email before it can be linked');
  }
  const mapped = await prisma.user.findUnique({ where: { supabaseUserId: providerId }, select: { id: true } });
  if (mapped) throw new Error('Provider identity is already linked to an application account');
  try {
    return await persist({ providerId, temporaryPassword: isNew ? temporaryPassword : undefined, existingProviderAccount: !isNew });
  } catch (error) {
    if (isNew) {
      try {
        // Never remove an identity that a competing, successful transaction has already linked.
        const linked = await prisma.user.findUnique({ where: { supabaseUserId: providerId }, select: { id: true } });
        if (!linked) {
          const removed = await supabaseAdmin.auth.admin.deleteUser(providerId);
          if (removed.error) console.error('[Provisioning] Provider cleanup failed; retry can recover the verified identity');
        }
      } catch { console.error('[Provisioning] Cleanup unavailable; retry can recover the verified identity'); }
    }
    throw error;
  }
}

export async function updateProviderAccount(providerId: string | null | undefined, updates: { email?: string; password?: string; app_metadata?: Record<string, unknown> }) {
  if (!providerId) return;
  if (!supabaseAdmin) throw new Error('Authentication provider is unavailable');
  const response = await supabaseAdmin.auth.admin.updateUserById(providerId, updates);
  if (response.error) throw new Error(response.error.message);
}
