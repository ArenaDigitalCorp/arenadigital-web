import { assertArenaAdminAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { getArenaUsersAction } from '@/modules/users/actions/userActions'
import { UsersPageClient } from '@/modules/users/components/UsersPageClient'
import { redirect } from 'next/navigation'
import { buildTutorialUsers } from '@/lib/tutorial-mock-data'

export default async function UsersCRUDPage({
    params,
    searchParams,
}: {
    params: Promise<{ arenaId: string }>
    searchParams: Promise<{ tutorial?: string }>
}) {
    const { arenaId } = await params
    const { tutorial } = await searchParams

    try {
        await assertArenaAdminAccess(arenaId)
    } catch {
        redirect('/dashboard/settings/arenas')
    }

    if (tutorial === '1') {
        return (
            <UsersPageClient
                arenaId={arenaId}
                arenaName="Arena demonstrativa"
                initialUsers={buildTutorialUsers()}
                stations={[{ id: 'tutorial-station-1', name: 'Bar Principal' }]}
            />
        )
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
