import { redirect } from 'next/navigation'
import { assertArenaBackofficeAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { SupabaseLoyaltyRepository } from '@/modules/loyalty/repositories/SupabaseLoyaltyRepository'
import { LoyaltyTopAthletesClient } from '@/modules/loyalty/components/LoyaltyTopAthletesClient'

export default async function Page({ params }: { params: Promise<{ arenaId: string }> }) {
  const { arenaId } = await params
  let userId: string
  try {
    userId = (await assertArenaBackofficeAccess(arenaId)).dbUserId
  } catch {
    redirect('/dashboard/settings/arenas')
  }
  const repo = new SupabaseLoyaltyRepository(getSupabaseAdmin())
  const initialData = await repo.getAthletesWithBalance(arenaId, 1, 10)
  return <LoyaltyTopAthletesClient key={`${arenaId}:${userId}`} arenaId={arenaId} userId={userId} initialData={initialData} />
}
