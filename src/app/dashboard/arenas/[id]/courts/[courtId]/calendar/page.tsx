import { assertCourtAccess, assertArenaResourceAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { SupabaseBookingRepository } from '@/modules/bookings/repositories/SupabaseBookingRepository'
import { CourtCalendarPageClient } from '@/modules/bookings/components/CourtCalendarPageClient'
import {
    normalizeCourtSports,
    type CourtWithSportRelations,
} from '@/modules/courts/utils/normalize-court-sports'
import { redirect } from 'next/navigation'
import { startOfDay, addDays, subDays } from 'date-fns'

export default async function CourtCalendarPage({ params }: { params: Promise<{ id: string; courtId: string }> }) {
    const { id: arenaId, courtId } = await params

    let access: Awaited<ReturnType<typeof assertArenaResourceAccess>>
    try {
        access = await assertArenaResourceAccess(arenaId, 'bookings.single', 'bookings.recurring')
        await assertCourtAccess(courtId, arenaId)
    } catch {
        redirect(`/dashboard/arenas/${arenaId}`)
    }

    const supabase = getSupabaseAdmin()
    const now = new Date()
    // Extend range by 1 day on each side to handle any UTC offset (server runs in UTC)
    const todayStart = startOfDay(subDays(now, 1)).toISOString()
    const todayEnd = startOfDay(addDays(now, 2)).toISOString()

    const [courtRes, bookings] = await Promise.all([
        supabase
            .from('courts')
            .select(`*, sports:court_sports(sport:sports(*))`)
            .eq('id', courtId)
            .eq('arena_id', arenaId)
            .single(),
        new SupabaseBookingRepository(supabase, access.resources).findByCourt(courtId, todayStart, todayEnd),
    ])

    if (courtRes.error || !courtRes.data) redirect(`/dashboard/arenas/${arenaId}`)

    const court = normalizeCourtSports(courtRes.data as CourtWithSportRelations)

    return (
        <CourtCalendarPageClient
            arenaId={arenaId}
            courtId={courtId}
            initialCourt={court}
            initialBookings={bookings}
            initialDate={now.toISOString()}
        />
    )
}
