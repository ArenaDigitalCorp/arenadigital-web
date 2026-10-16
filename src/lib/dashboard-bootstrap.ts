import { loadAccessibleArenas } from '@/lib/accessible-arenas'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { getPlatformAccessLevel, requireWebBackofficeAccess } from '@/lib/server-auth'
import type { DashboardBootstrap, DashboardUser } from '@/lib/dashboard-bootstrap.types'

export async function loadDashboardBootstrap(): Promise<DashboardBootstrap> {
  // Authenticate here as well: callers cannot supply an arbitrary user id.
  // During an RSC render this reuses the layout's request-scoped identity/access.
  const { dbUserId } = await requireWebBackofficeAccess()
  const [userResult, arenasResult] = await Promise.allSettled([
    loadUser(dbUserId),
    loadAccessibleArenas(dbUserId),
  ])

  // A transient bootstrap failure retains the existing endpoint/retry flow.
  // Do not turn an unavailable arena list into a successfully loaded empty list.
  if (userResult.status === 'rejected') console.error('[dashboard/bootstrap] Failed to load user')
  if (arenasResult.status === 'rejected') console.error('[dashboard/bootstrap] Failed to load arenas')
  return {
    user: userResult.status === 'fulfilled' ? userResult.value : null,
    arenas: userResult.status === 'fulfilled' && arenasResult.status === 'fulfilled' ? arenasResult.value : null,
  }
}

async function loadUser(dbUserId: string): Promise<DashboardUser> {
  const [{ data, error }, platformAccessLevel] = await Promise.all([
    getSupabaseAdmin().from('users')
      .select('id, email, name, role, created_at, onboarding_completed_at, onboarding_version')
      .eq('id', dbUserId).maybeSingle(),
    getPlatformAccessLevel(dbUserId),
  ])
  if (error || !data) throw new Error('Failed to load dashboard user')
  return { ...data, platform_access_level: platformAccessLevel }
}
