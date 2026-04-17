"use server"

import { getSupabaseAdmin } from '@/lib/supabase-server'
import { assertArenaBackofficeAccess, assertBookingAccess, assertCourtAccess } from '@/lib/server-auth'
import { SupabaseBookingRepository } from '@/modules/bookings/repositories/SupabaseBookingRepository'
import type { Booking, CreateBookingDTO } from '@/modules/bookings/types/booking.types'
import { revalidatePath } from 'next/cache'

export async function getBookingsByCourtAction(
    arenaId: string,
    courtId: string,
    startDate?: string,
    endDate?: string
): Promise<{ success: boolean; data?: Booking[]; error?: string }> {
    try {
        await assertCourtAccess(courtId, arenaId)
        const repo = new SupabaseBookingRepository(getSupabaseAdmin())
        const data = await repo.findByCourt(courtId, startDate, endDate)
        return { success: true, data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar reservas'
        return { success: false, error: message }
    }
}

export async function getBookingsByArenaAction(
    arenaId: string,
    startDate?: string,
    endDate?: string
): Promise<{ success: boolean; data?: Booking[]; error?: string }> {
    try {
        await assertArenaBackofficeAccess(arenaId)
        const repo = new SupabaseBookingRepository(getSupabaseAdmin())
        const data = await repo.findByArena(arenaId, startDate, endDate)
        return { success: true, data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar reservas'
        return { success: false, error: message }
    }
}

export async function getBookingsByArenaWithSportsAction(
    arenaId: string,
    startDate: string,
    endDate: string
): Promise<{ success: boolean; data?: Booking[]; error?: string }> {
    try {
        await assertArenaBackofficeAccess(arenaId)
        const repo = new SupabaseBookingRepository(getSupabaseAdmin())
        const data = await repo.findByArenaWithSports(arenaId, startDate, endDate)
        return { success: true, data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar reservas'
        return { success: false, error: message }
    }
}

export async function updateBookingStatusAction(
    arenaId: string,
    bookingId: string,
    status: 'confirmed' | 'cancelled'
): Promise<{ success: boolean; error?: string }> {
    try {
        await assertBookingAccess(bookingId, arenaId)
        const repo = new SupabaseBookingRepository(getSupabaseAdmin())
        await repo.updateStatus(bookingId, status)
        revalidatePath(`/dashboard/arenas/${arenaId}/courts`)
        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao atualizar reserva'
        return { success: false, error: message }
    }
}

export async function createBookingAction(
    arenaId: string,
    input: CreateBookingDTO
): Promise<{ success: boolean; data?: Booking; error?: string }> {
    try {
        await assertArenaBackofficeAccess(arenaId)
        if (input.arena_id !== arenaId) {
            throw new Error('Reserva não pertence à arena informada')
        }
        await assertCourtAccess(input.court_id, arenaId)
        const repo = new SupabaseBookingRepository(getSupabaseAdmin())
        const data = await repo.create(input)
        revalidatePath(`/dashboard/arenas/${arenaId}/courts`)
        return { success: true, data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao criar reserva'
        return { success: false, error: message }
    }
}

export async function createRecurringBookingsAction(
    arenaId: string,
    inputs: CreateBookingDTO[]
): Promise<{ success: boolean; data?: Booking[]; error?: string }> {
    try {
        await assertArenaBackofficeAccess(arenaId)
        for (const input of inputs) {
            if (input.arena_id !== arenaId) {
                throw new Error('Reserva não pertence à arena informada')
            }
            await assertCourtAccess(input.court_id, arenaId)
        }
        const repo = new SupabaseBookingRepository(getSupabaseAdmin())
        const data = await repo.createMany(inputs)
        revalidatePath(`/dashboard/arenas/${arenaId}/courts`)
        return { success: true, data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao criar reservas recorrentes'
        return { success: false, error: message }
    }
}
