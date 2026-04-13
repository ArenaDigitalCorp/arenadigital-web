import { requireAuthenticatedDbUser } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { SupabaseArenaRepository } from '@/modules/arenas/repositories/SupabaseArenaRepository'
import { SupabaseBookingRepository } from '@/modules/bookings/repositories/SupabaseBookingRepository'
import { SchedulePageClient } from './SchedulePageClient'

export default async function SchedulePage() {
    const { dbUserId } = await requireAuthenticatedDbUser()

    const supabase = getSupabaseAdmin()
    const arenas = await new SupabaseArenaRepository(supabase).findByOwnerId(dbUserId)

    const firstArenaId = arenas[0]?.id ?? null
    const bookings = firstArenaId
        ? await new SupabaseBookingRepository(supabase).findByArena(firstArenaId)
        : []

    return (
        <SchedulePageClient
            initialArenas={arenas}
            initialArenaId={firstArenaId}
            initialBookings={bookings}
        />
    )
}
