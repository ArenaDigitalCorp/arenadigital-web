import 'server-only'

import {
  AuthorizationError,
  assertArenaAdminAccess,
  assertPlatformSuperAdminAccess,
} from '@/lib/server-auth'

export type ArenaFinancialOnboardingAccess = {
  dbUserId: string
  source: 'arena_self_service' | 'super_admin_backoffice'
}

export async function assertArenaFinancialOnboardingAccess(
  arenaId: string,
): Promise<ArenaFinancialOnboardingAccess> {
  let arenaAccessError: unknown
  try {
    const profile = await assertArenaAdminAccess(arenaId)
    return { dbUserId: profile.dbUserId, source: 'arena_self_service' }
  } catch (error) {
    if (!(error instanceof AuthorizationError) || error.status !== 403) throw error
    arenaAccessError = error
  }

  try {
    const profile = await assertPlatformSuperAdminAccess()
    return { dbUserId: profile.dbUserId, source: 'super_admin_backoffice' }
  } catch {
    throw arenaAccessError
  }
}
