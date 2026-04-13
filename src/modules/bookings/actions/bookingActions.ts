"use server"

import { getSupabaseAdmin } from '@/lib/supabase-server'
import { assertArenaAccess } from '@/lib/server-auth'
import { SupabaseBookingRepository } from '@/modules/bookings/repositories/SupabaseBookingRepository'
import type { Booking } from '@/modules/bookings/types/booking.types'

export async function getBookingsByCourtAction(
    arenaId: string,
    courtId: string,
    startDate?: string,
    endDate?: string
): Promise<{ success: boolean; data?: Booking[]; error?: string }> {
    try {
        await assertArenaAccess(arenaId)
        const repo = new SupabaseBookingRepository(getSupabaseAdmin())
        const data = await repo.findByCourt(courtId, startDate, endDate)
        return { success: true, data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar reservas'
        return { success: false, error: message }
    }
}

export async function getBookingsByArenaAction(
    arenaId: string
): Promise<{ success: boolean; data?: Booking[]; error?: string }> {
    try {
        await assertArenaAccess(arenaId)
        const repo = new SupabaseBookingRepository(getSupabaseAdmin())
        const data = await repo.findByArena(arenaId)
        return { success: true, data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar reservas'
        return { success: false, error: message }
    }
}
