import { assertArenaBackofficeAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { getArenaUsersAction } from '@/modules/users/actions/userActions'
import { UsersPageClient } from './UsersPageClient'
import { redirect } from 'next/navigation'

export default async function UsersCRUDPage({ params }: { params: Promise<{ arenaId: string }> }) {
    const { arenaId } = await params

    try {
        await assertArenaBackofficeAccess(arenaId)
    } catch {
        redirect('/dashboard/settings/arenas')
    }

    const supabase = getSupabaseAdmin()
    const [arenaResult, usersResult, stationsResult] = await Promise.all([
        supabase.from('arenas').select('id, name').eq('id', arenaId).single(),
        getArenaUsersAction(arenaId),
        supabase.from('stations').select('id, name').eq('arena_id', arenaId).order('name'),
    ])

    if (arenaResult.error || !arenaResult.data) {
        redirect('/dashboard/settings/arenas')
    }

    return (
        <UsersPageClient
            arenaId={arenaId}
            arenaName={arenaResult.data.name}
            initialUsers={usersResult.success ? (usersResult.data ?? []) : []}
            stations={(stationsResult.data ?? []).map((station) => ({ id: station.id, name: station.name }))}
        />
    )
}
