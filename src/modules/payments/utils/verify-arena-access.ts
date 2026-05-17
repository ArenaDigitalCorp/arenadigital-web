import {
  assertArenaSubscriptionAccess,
  AuthorizationError,
  requireAuthenticatedDbUser
} from '@/lib/server-auth'

export async function verifyArenaAccess(
  authUserId: string,
  arenaId: string
): Promise<boolean> {
  try {
    const currentUser = await requireAuthenticatedDbUser()

    if (currentUser.authUserId !== authUserId) {
      return false
    }

    await assertArenaSubscriptionAccess(arenaId)
    return true
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return false
    }

    console.error('[verifyArenaAccess] Failed to verify access', error)
    return false
  }
}
