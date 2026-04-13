import { requireAuthenticatedDbUser } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { SupabaseArenaRepository } from '@/modules/arenas/repositories/SupabaseArenaRepository'
import { ArenasSettingsClient } from './ArenasSettingsClient'

export default async function SettingsArenasPage() {
    const { dbUserId } = await requireAuthenticatedDbUser()
    const repo = new SupabaseArenaRepository(getSupabaseAdmin())
    const arenas = await repo.findByOwnerId(dbUserId)

    return <ArenasSettingsClient initialArenas={arenas} />
}
