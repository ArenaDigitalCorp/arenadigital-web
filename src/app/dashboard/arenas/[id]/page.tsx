import { assertArenaBackofficeAccess } from '@/lib/server-auth'
import { canManageArena } from '@/lib/arena-permissions'
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

    let access: Awaited<ReturnType<typeof assertArenaBackofficeAccess>>
    try {
        access = await assertArenaBackofficeAccess(id)
    } catch {
        redirect('/dashboard/settings/arenas')
    }

    const initialTab = parseArenaDashboardTab(tab)
    if (tutorial === '1') {
        return (
            <ArenaDetailPageClient
                arenaId={id}
                arenaName="Arena demonstrativa"
                initialCourts={buildTutorialCourts(id)}
                initialBookings={buildTutorialBookings(id)}
                initialTab={initialTab}
                canManage={canManageArena(access)}
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
        new SupabaseBookingRepository(supabase).findByArena(id, startOfDay, endOfDay),
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
            canManage={canManageArena(access)}
        />
    )
}
