import { assertArenaAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { getArenaUsersAction } from '@/modules/users/actions/userActions'
import { UsersPageClient } from './UsersPageClient'
import { redirect } from 'next/navigation'

export default async function UsersCRUDPage({ params }: { params: Promise<{ arenaId: string }> }) {
    const { arenaId } = await params

    try {
        await assertArenaAccess(arenaId)
    } catch {
        redirect('/dashboard/settings/arenas')
    }

    const supabase = getSupabaseAdmin()
    const [arenaResult, usersResult] = await Promise.all([
        supabase.from('arenas').select('id, name').eq('id', arenaId).single(),
        getArenaUsersAction(arenaId),
    ])

    if (arenaResult.error || !arenaResult.data) {
        redirect('/dashboard/settings/arenas')
    }

    return (
        <UsersPageClient
            arenaId={arenaId}
            arenaName={arenaResult.data.name}
            initialUsers={usersResult.success ? (usersResult.data ?? []) : []}
        />
    )
}
