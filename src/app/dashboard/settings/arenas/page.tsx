import { redirect } from 'next/navigation'
import { requireAuthenticatedDbUser } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { SupabaseArenaRepository } from '@/modules/arenas/repositories/SupabaseArenaRepository'
import { ArenasSettingsClient } from './ArenasSettingsClient'

export default async function SettingsArenasPage() {
    const { dbUserId } = await requireAuthenticatedDbUser()
    const supabase = getSupabaseAdmin()

    const { data: linkedRows, error: linkedError } = await supabase
        .from('arena_users')
        .select('arena_id')
        .eq('user_id', dbUserId)
        .in('status', ['Ativo', 'ativo', 'active'])
        .in('role', ['Gestor', 'Atendente'])

    if (linkedError) {
        throw new Error(`Erro ao carregar arenas vinculadas: ${linkedError.message}`)
    }

    const linkedArenaIds = linkedRows?.map((row) => row.arena_id) ?? []
    const repo = new SupabaseArenaRepository(supabase)
    const arenas = await repo.findByOwnerId(dbUserId)
    const visibleArenas = arenas.filter(
        (arena) => arena.owner_id === dbUserId || linkedArenaIds.includes(arena.id)
    )

    if (visibleArenas.length === 0) {
        redirect('/dashboard')
    }

    return <ArenasSettingsClient initialArenas={visibleArenas} />
}
