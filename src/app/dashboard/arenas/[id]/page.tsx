import { assertArenaResourceAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { SupabaseArenaRepository } from '@/modules/arenas/repositories/SupabaseArenaRepository'
import { SupabaseBookingRepository } from '@/modules/bookings/repositories/SupabaseBookingRepository'
import { ArenaDetailPageClient } from '@/modules/arenas/components/ArenaDetailPageClient'
import {
    normalizeCourtSports,
    type CourtWithSportRelations,
} from '@/modules/courts/utils/normalize-court-sports'
import { parseArenaDashboardTab } from '@/lib/arena-dashboard-navigation'
import { redirect } from 'next/navigation'
import { buildTutorialBookings, buildTutorialCourts } from '@/lib/tutorial-mock-data'
export default async function ArenaDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>
    searchParams: Promise<{ tab?: string; tutorial?: string }>
}) {
    const { id } = await params
    const { tab, tutorial } = await searchParams

    let access: Awaited<ReturnType<typeof assertArenaResourceAccess>>
    try {
        access = await assertArenaResourceAccess(id, 'spaces', 'bookings.single', 'bookings.recurring')
    } catch {
        redirect('/dashboard/settings/arenas')
    }

    const canManage = access.resources.includes('spaces')
    const canOperate = access.resources.includes('bookings.single') || access.resources.includes('bookings.recurring')
    const requestedTab = parseArenaDashboardTab(tab)
    const initialTab = canManage ? (requestedTab === 'operacao' && !canOperate ? 'espacos' : requestedTab) : 'operacao'
    if (tutorial === '1') {
        return (
            <ArenaDetailPageClient
                arenaId={id}
                arenaName="Arena demonstrativa"
                initialCourts={buildTutorialCourts(id)}
                initialBookings={canOperate ? buildTutorialBookings(id) : []}
                initialTab={initialTab}
                canManage={canManage} canOperate={canOperate}
            />
        )
    }

    const supabase = getSupabaseAdmin()
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString()
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString()

    const [arena, courtsRaw, bookings] = await Promise.all([
        new SupabaseArenaRepository(supabase).findById(id),
        supabase
            .from('courts')
            .select(`*, sports:court_sports(sport:sports(*))`)
            .eq('arena_id', id)
            .order('created_at', { ascending: false }),
        canOperate ? new SupabaseBookingRepository(supabase, access.resources).findByArena(id, startOfDay, endOfDay) : [],
    ])

    if (!arena) redirect('/dashboard/settings/arenas')

    const courts = (courtsRaw.data ?? []).map((court) =>
        normalizeCourtSports(court as CourtWithSportRelations)
    )

    return (
        <ArenaDetailPageClient
            arenaId={id}
            arenaName={arena.name}
            initialCourts={courts}
            initialBookings={bookings}
            initialTab={initialTab}
            canManage={canManage} canOperate={canOperate}
        />
    )
}
