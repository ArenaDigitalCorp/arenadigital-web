import { notFound } from 'next/navigation'
import { assertArenaAdminAccess, AuthorizationError } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { loadAccessManagement } from '@/modules/access/server'
import { UsersPageClient } from '@/modules/users/components/UsersPageClient'
import { buildTutorialUsers } from '@/lib/tutorial-mock-data'

export default async function UsersCRUDPage({ params, searchParams }: {
    params: Promise<{ arenaId: string }>
    searchParams: Promise<{ tutorial?: string }>
}) {
    const { arenaId } = await params
    let actor
    try {
        actor = await assertArenaAdminAccess(arenaId, 'settings.users')
    } catch (error) {
        if (error instanceof AuthorizationError) notFound()
        throw error
    }
    if ((await searchParams).tutorial === '1') {
        return <UsersPageClient arenaId={arenaId} arenaName="Arena demonstrativa" readOnly profiles={[]}
            initialUsers={buildTutorialUsers().map(u => ({ ...u, editable: false, profileId: '', profileName: u.role }))}
            stations={[]} />
    }
    const supabase = getSupabaseAdmin()
    const [arena, management, stations] = await Promise.all([
        supabase.from('arenas').select('name,owner_id').eq('id', arenaId).single(),
        loadAccessManagement(arenaId),
        supabase.from('stations').select('id,name').eq('arena_id', arenaId).order('name'),
    ])
    if (arena.error || !arena.data || stations.error) throw new Error('Não foi possível carregar os usuários da arena.')
    const ownerId = arena.data.owner_id
    return <UsersPageClient key={arenaId} arenaId={arenaId} arenaName={arena.data.name}
        profiles={management.profiles} isOwner={actor.isOwner}
        initialUsers={management.members.map(m => ({
            arenaUserId: m.id, id: m.user_id, name: m.name ?? '', email: m.email, role: m.role,
            profileId: m.profile_id, profileName: m.profile_name, stationId: m.station_id, status: m.status,
            editable: m.user_id !== ownerId && (actor.isOwner || (actor.dbUserId !== m.user_id && m.role !== 'Gestor' && management.profiles.some(p => p.id === m.profile_id))),
        }))} stations={stations.data ?? []} />
}
