import { loadAccessibleArenas } from '@/lib/accessible-arenas'
import { redirect } from 'next/navigation'
import { requireAuthenticatedDbUser } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { SupabaseArenaRepository } from '@/modules/arenas/repositories/SupabaseArenaRepository'
import { ArenasSettingsClient } from '@/modules/arenas/components/ArenasSettingsClient'

export default async function SettingsArenasPage() {
    const { dbUserId } = await requireAuthenticatedDbUser()
    const supabase = getSupabaseAdmin()

    const targets = await loadAccessibleArenas(dbUserId)
    const visibleIds = targets.filter(arena => arena.resources.includes('settings.arena')).map(arena => arena.id)
    const repo = new SupabaseArenaRepository(supabase)
    const visibleArenas = await Promise.all(visibleIds.map(id => repo.findRegistrationById(id)))

    if (visibleArenas.length === 0) {
        redirect('/dashboard')
    }

    return <ArenasSettingsClient initialArenas={visibleArenas.filter(arena => arena !== null)} />
}
