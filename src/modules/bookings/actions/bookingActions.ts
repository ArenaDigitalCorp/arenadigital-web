"use server"

import { getSupabaseAdmin } from '@/lib/supabase-server'
import { assertArenaBackofficeAccess, assertBookingAccess, assertCourtAccess, requireAuthenticatedDbUser } from '@/lib/server-auth'
import { SupabaseBookingRepository } from '@/modules/bookings/repositories/SupabaseBookingRepository'
import type { Booking, CreateBookingDTO, UpdateBookingDTO } from '@/modules/bookings/types/booking.types'
import { revalidatePath } from 'next/cache'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function revalidateBookingFinancePaths(arenaId: string) {
    revalidatePath(`/dashboard/arenas/${arenaId}`)
    revalidatePath(`/dashboard/arenas/${arenaId}/courts`)
    revalidatePath(`/dashboard/finance/${arenaId}`)
    revalidatePath(`/dashboard/reports/${arenaId}/status-pagamentos`)
}

function isBlockingBookingStatus(row: { status: string | null; payment_expires_at?: string | null }): boolean {
    if (row.status === 'confirmed' || row.status === 'reservado') return true
    if (row.status !== 'pending_payment') return false
    if (!row.payment_expires_at) return true
    return new Date(row.payment_expires_at).getTime() > Date.now()
}


export async function confirmarPagamentoAvulsoAction(
    arenaId: string,
    bookingId: string,
    valorOverride?: number,
    modoPagamentoId?: string | null
): Promise<{ success: boolean; error?: string }> {
    try {
        await assertBookingAccess(bookingId, arenaId)
        const { dbUserId } = await requireAuthenticatedDbUser()
        const supabase = getSupabaseAdmin()

        const { error } = await supabase.rpc('confirm_backoffice_booking_payment', {
            p_arena_id: arenaId,
            p_booking_id: bookingId,
            p_registered_by: dbUserId,
            p_amount: valorOverride !== undefined && valorOverride > 0 ? valorOverride : undefined,
            p_modo_pagamento_id: modoPagamentoId ?? undefined,
        })

        if (error) throw new Error(error.message)

        revalidateBookingFinancePaths(arenaId)
        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao confirmar pagamento'
        return { success: false, error: message }
    }
}

export async function confirmarPagamentoParticipanteAvulsoAction(
    arenaId: string,
    bookingId: string,
    participantId: string,
    valorOverride?: number,
    modoPagamentoId?: string | null
): Promise<{ success: boolean; error?: string }> {
    try {
        await assertBookingAccess(bookingId, arenaId)
        const { dbUserId } = await requireAuthenticatedDbUser()
        const supabase = getSupabaseAdmin()

        const { error } = await supabase.rpc('confirm_backoffice_participant_payment', {
            p_arena_id: arenaId,
            p_booking_id: bookingId,
            p_participant_id: participantId,
            p_registered_by: dbUserId,
            p_amount: valorOverride !== undefined && valorOverride > 0 ? valorOverride : undefined,
            p_modo_pagamento_id: modoPagamentoId ?? undefined,
        })

        if (error) throw new Error(error.message)
        revalidateBookingFinancePaths(arenaId)
        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao confirmar pagamento do participante'
        return { success: false, error: message }
    }
}

export interface BookingConflict {
    date: string          // ISO string da reserva conflitante existente
    startTime: string     // "HH:MM" formatado
    endTime: string       // "HH:MM" formatado
    athleteName: string   // nome do atleta que já tem esse horário
    proposedDate: string  // data/hora que o usuário tentou reservar (formatada)
}

export type BackofficeBookingBundleInput = {
    operationId: string
    updateBookingId?: string | null
    courtId: string
    athleteName: string
    athleteId?: string | null
    sportId?: string | null
    rentalPrice: number
    splitBilling: boolean
    recurrenceId?: string | null
    slots: { start_time: string; end_time: string }[]
    services: { product_id: string; quantity: number }[]
    additionalAthleteIds: string[]
}

export async function saveBackofficeBookingBundleAction(
    arenaId: string,
    input: BackofficeBookingBundleInput
): Promise<{ success: boolean; data?: Booking[]; idempotent?: boolean; error?: string }> {
    try {
        await assertArenaBackofficeAccess(arenaId)
        await assertCourtAccess(input.courtId, arenaId)
        if (input.updateBookingId) {
            await assertBookingAccess(input.updateBookingId, arenaId)
        }
        const { dbUserId } = await requireAuthenticatedDbUser()

        if (!Number.isFinite(input.rentalPrice) || input.rentalPrice < 0) {
            throw new Error('Valor da locação inválido')
        }
        if (input.slots.length < 1 || input.slots.length > 52) {
            throw new Error('Conjunto de horários inválido')
        }

        const safeSlots = input.slots.map(({ start_time, end_time }) => ({ start_time, end_time }))
        const safeServices = input.services.map(({ product_id, quantity }) => ({ product_id, quantity }))
        const safeAdditionalAthletes = Array.from(new Set(input.additionalAthleteIds))
        const rpc = getSupabaseAdmin() as unknown as {
            rpc: (
                name: 'save_backoffice_booking_bundle_atomic',
                args: Record<string, unknown>
            ) => Promise<{
                data: { bookings?: Booking[]; idempotent?: boolean } | null
                error: { message: string } | null
            }>
        }
        const { data, error } = await rpc.rpc('save_backoffice_booking_bundle_atomic', {
            p_operation_id: input.operationId,
            p_arena_id: arenaId,
            p_update_booking_id: input.updateBookingId ?? null,
            p_court_id: input.courtId,
            p_athlete_name: input.athleteName.trim(),
            p_athlete_id: input.athleteId ?? null,
            p_sport_id: input.sportId ?? null,
            p_rental_price: input.rentalPrice,
            p_cobranca_por_participante: input.splitBilling,
            p_recurrence_id: input.recurrenceId ?? null,
            p_slots: safeSlots,
            p_services: safeServices,
            p_responsible_athlete_id: input.athleteId ?? null,
            p_additional_athlete_ids: safeAdditionalAthletes,
            p_participant_value: input.splitBilling ? input.rentalPrice : null,
            p_registered_by: dbUserId,
        })

        if (error) throw new Error(error.message)
        revalidateBookingFinancePaths(arenaId)
        return {
            success: true,
            data: data?.bookings ?? [],
            idempotent: data?.idempotent ?? false,
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao salvar reserva'
        return { success: false, error: message }
    }
}

type BookingConflictRow = {
    athlete_name: string | null
    start_time: string
    end_time: string
    status: string | null
    payment_expires_at?: string | null
}

/**
 * Verifica conflitos de horário para uma lista de períodos (avulso com recorrência ou mensalista).
 * Retorna todos os conflitos encontrados sem bloquear — a decisão de prosseguir fica no cliente.
 */
export async function checkBookingConflictsAction(
    arenaId: string,
    courtId: string,
    slots: { startTime: string; endTime: string }[],
    excludeBookingId?: string
): Promise<{ success: boolean; conflicts: BookingConflict[]; error?: string }> {
    try {
        await assertCourtAccess(courtId, arenaId)
        const supabase = getSupabaseAdmin()
        const conflicts: BookingConflict[] = []

        for (const slot of slots) {
            let query = supabase
                .from('bookings')
                .select('athlete_name, start_time, end_time, status, payment_expires_at')
                .eq('court_id', courtId)
                .in('status', ['confirmed', 'reservado', 'pending_payment'])
                .lt('start_time', slot.endTime)
                .gt('end_time', slot.startTime)

            if (excludeBookingId) {
                query = query.neq('id', excludeBookingId)
            }

            const { data, error } = await query.limit(50)

            if (error) throw new Error(error.message)

            const existing = ((data ?? []) as unknown as BookingConflictRow[]).find(isBlockingBookingStatus)
            if (existing) {
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
        await assertArenaBackofficeAccess(arenaId)
        await assertBookingAccess(bookingId, arenaId)
        const supabase = getSupabaseAdmin()

        if (status === 'cancelled') {
            const { data: existing, error: fetchError } = await supabase
                .from('bookings')
                .select('status, plano_mensalista_id')
                .eq('id', bookingId)
                .eq('arena_id', arenaId)
                .single()

            if (fetchError || !existing) throw new Error('Reserva não encontrada')
            if (existing.status === 'confirmed') {
                throw new Error('Não é possível cancelar uma reserva já paga')
            }
            if (existing.plano_mensalista_id) {
                throw new Error('Reservas de mensalista devem ser gerenciadas em Mensalistas')
            }
            if (existing.status === 'cancelled') {
                throw new Error('Esta reserva já está cancelada')
            }
        }

        const repo = new SupabaseBookingRepository(supabase)
        await repo.updateStatus(bookingId, status)
        revalidatePath(`/dashboard/arenas/${arenaId}`)
        revalidatePath(`/dashboard/arenas/${arenaId}/courts`)
        revalidatePath(`/dashboard/finance/${arenaId}`)
        revalidatePath(`/dashboard/reports/${arenaId}/status-pagamentos`)
        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao atualizar reserva'
        return { success: false, error: message }
    }
}

export async function updateBookingAction(
    arenaId: string,
    bookingId: string,
    input: Pick<UpdateBookingDTO, 'athlete_name' | 'athlete_id' | 'sport_id' | 'start_time' | 'end_time' | 'price' | 'cobranca_por_participante'>
): Promise<{ success: boolean; data?: Booking; error?: string }> {
    try {
        await assertArenaBackofficeAccess(arenaId)
        await assertBookingAccess(bookingId, arenaId)
        const supabase = getSupabaseAdmin()
        const { data: existing } = await supabase
            .from('bookings')
            .select('court_id, cobranca_por_participante, status')
            .eq('id', bookingId)
            .single()
        if (!existing) throw new Error('Reserva não encontrada')
        const courtId = (existing as { court_id: string }).court_id
        await assertCourtAccess(courtId, arenaId)

        const turningOffSplit =
            existing.cobranca_por_participante &&
            input.cobranca_por_participante === false

        if (turningOffSplit) {
            const { data: paidParts, error: paidError } = await supabase
                .from('booking_participants')
                .select('id')
                .eq('booking_id', bookingId)
                .in('funcao', ['responsavel', 'convidado'])
                .not('pago_em', 'is', null)
                .limit(1)

            if (paidError) throw new Error(paidError.message)
            if (paidParts?.length) {
                throw new Error(
                    'Não é possível desativar cobrança separada após confirmar pagamento de participantes'
                )
            }
        }

        const { data: rpcData, error } = await supabase.rpc('update_backoffice_booking', {
            p_arena_id: arenaId,
            p_booking_id: bookingId,
            p_athlete_name: input.athlete_name ?? '',
            p_athlete_id: input.athlete_id ?? null,
            p_sport_id: input.sport_id ?? null,
            p_start_time: input.start_time as string,
            p_end_time: input.end_time as string,
            p_price: input.price ?? null,
            p_cobranca_por_participante: input.cobranca_por_participante ?? false,
        })

        if (error) throw new Error(error.message)
        const data = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as Booking

        revalidateBookingFinancePaths(arenaId)
        return { success: true, data }
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
        const { dbUserId } = await requireAuthenticatedDbUser()
        if (input.arena_id !== arenaId) {
            throw new Error('Reserva não pertence à arena informada')
        }
        await assertCourtAccess(input.court_id, arenaId)
        const supabase = getSupabaseAdmin()
        const { data: rpcData, error } = await supabase.rpc('create_backoffice_booking', {
            p_arena_id: arenaId,
            p_court_id: input.court_id,
            p_athlete_name: input.athlete_name ?? '',
            p_start_time: input.start_time,
            p_end_time: input.end_time,
            p_status: input.status ?? 'confirmed',
            p_athlete_id: input.athlete_id ?? undefined,
            p_sport_id: input.sport_id ?? undefined,
            p_price: input.price ?? 0,
            p_recurrence_id: input.recurrence_id ?? undefined,
            p_booking_type: input.booking_type ?? 'avulso',
            p_plano_mensalista_id: input.plano_mensalista_id ?? undefined,
            p_cobranca_por_participante: input.cobranca_por_participante ?? false,
            p_registered_by: dbUserId,
            p_modo_pagamento_id: undefined,
        })

        if (error) throw new Error(error.message)
        const data = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as Booking

        revalidatePath(`/dashboard/arenas/${arenaId}`)
        revalidatePath(`/dashboard/arenas/${arenaId}/courts`)
        revalidatePath(`/dashboard/finance/${arenaId}`)
        revalidatePath(`/dashboard/reports/${arenaId}/status-pagamentos`)
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
        const { dbUserId } = await requireAuthenticatedDbUser()
        for (const input of inputs) {
            if (input.arena_id !== arenaId) {
                throw new Error('Reserva não pertence à arena informada')
            }
            await assertCourtAccess(input.court_id, arenaId)
        }
        const supabase = getSupabaseAdmin()
        const { data: rpcData, error } = await supabase.rpc('create_backoffice_bookings', {
            p_bookings: inputs,
            p_registered_by: dbUserId,
            p_modo_pagamento_id: undefined,
        })

        if (error) throw new Error(error.message)
        const data = (rpcData ?? []) as Booking[]

        revalidatePath(`/dashboard/arenas/${arenaId}`)
        revalidatePath(`/dashboard/arenas/${arenaId}/courts`)
        revalidatePath(`/dashboard/finance/${arenaId}`)
        revalidatePath(`/dashboard/reports/${arenaId}/status-pagamentos`)
        return { success: true, data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao criar reservas recorrentes'
        return { success: false, error: message }
    }
}
