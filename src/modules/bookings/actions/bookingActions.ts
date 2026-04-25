"use server"

import { getSupabaseAdmin } from '@/lib/supabase-server'
import { assertArenaBackofficeAccess, assertBookingAccess, assertCourtAccess } from '@/lib/server-auth'
import { SupabaseBookingRepository } from '@/modules/bookings/repositories/SupabaseBookingRepository'
import type { Booking, CreateBookingDTO } from '@/modules/bookings/types/booking.types'
import { revalidatePath } from 'next/cache'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export interface BookingConflict {
    date: string          // ISO string da reserva conflitante existente
    startTime: string     // "HH:MM" formatado
    endTime: string       // "HH:MM" formatado
    athleteName: string   // nome do atleta que já tem esse horário
    proposedDate: string  // data/hora que o usuário tentou reservar (formatada)
}

/**
 * Verifica conflitos de horário para uma lista de períodos (avulso com recorrência ou mensalista).
 * Retorna todos os conflitos encontrados sem bloquear — a decisão de prosseguir fica no cliente.
 */
export async function checkBookingConflictsAction(
    arenaId: string,
    courtId: string,
    slots: { startTime: string; endTime: string }[]
): Promise<{ success: boolean; conflicts: BookingConflict[]; error?: string }> {
    try {
        await assertCourtAccess(courtId, arenaId)
        const supabase = getSupabaseAdmin()
        const conflicts: BookingConflict[] = []

        for (const slot of slots) {
            const { data, error } = await supabase
                .from('bookings')
                .select('athlete_name, start_time, end_time')
                .eq('court_id', courtId)
                .in('status', ['confirmed', 'reservado'])
                .lt('start_time', slot.endTime)
                .gt('end_time', slot.startTime)
                .limit(1)

            if (error) throw new Error(error.message)

            if (data && data.length > 0) {
                const existing = data[0] as any
                conflicts.push({
                    date: existing.start_time,
                    startTime: format(new Date(existing.start_time), 'HH:mm', { locale: ptBR }),
                    endTime: format(new Date(existing.end_time), 'HH:mm', { locale: ptBR }),
                    athleteName: existing.athlete_name ?? 'Atleta',
                    proposedDate: format(new Date(slot.startTime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
                })
            }
        }

        return { success: true, conflicts }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao verificar conflitos'
        return { success: false, conflicts: [], error: message }
    }
}


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
        revalidatePath(`/dashboard/arenas/${arenaId}`)
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
        revalidatePath(`/dashboard/arenas/${arenaId}`)
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
        revalidatePath(`/dashboard/arenas/${arenaId}`)
        revalidatePath(`/dashboard/arenas/${arenaId}/courts`)
        return { success: true, data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao criar reservas recorrentes'
        return { success: false, error: message }
    }
}
