import { notFound } from 'next/navigation'
import { assertArenaOwnerAccess, AuthorizationError } from '@/lib/server-auth'
import { loadAccessManagement } from '@/modules/access/server'
import { ProfilesPanel } from '@/modules/access/components/ProfilesPanel'

export default async function ArenaProfilesPage({ params }: { params: Promise<{arenaId: string}> }) {
  const { arenaId } = await params
  try {
    await assertArenaOwnerAccess(arenaId)
  } catch (error) {
    if (error instanceof AuthorizationError) notFound()
    throw error
  }
  const management = await loadAccessManagement(arenaId)
  return <ProfilesPanel key={arenaId} arenaId={arenaId} management={management} />
}
