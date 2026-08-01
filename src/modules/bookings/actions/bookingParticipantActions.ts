"use server"

import { getSupabaseAdmin } from '@/lib/supabase-server'
import { assertArenaBackofficeAccess, assertBookingAccess } from '@/lib/server-auth'

export type BookingParticipantRow = {
    id: string
    atleta_id: string
    funcao: string
    status: string
    atleta?: { id: string; nome_perfil: string; telefone: string | null } | null
}

export async function getBookingParticipantsAction(
    arenaId: string,
    bookingId: string
): Promise<{ success: boolean; data?: BookingParticipantRow[]; error?: string }> {
    try {
        await assertArenaBackofficeAccess(arenaId)
        await assertBookingAccess(bookingId, arenaId)
        const supabase = getSupabaseAdmin()
        const { data, error } = await supabase
            .from('booking_participants')
            .select('id, atleta_id, funcao, status, atleta:atleta_id(id, nome_perfil, telefone)')
            .eq('booking_id', bookingId)
            .order('created_at', { ascending: true })

        if (error) throw new Error(error.message)
        return { success: true, data: (data ?? []) as BookingParticipantRow[] }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar participantes'
        return { success: false, error: message, data: [] }
    }
}

export type SyncBookingParticipantsInput = {
    responsibleAthleteId?: string | null
    additionalAthleteIds: string[]
    /** Valor individual quando cobranca_por_participante = true */
    valorPorParticipante?: number | null
}

export async function syncBookingParticipantsForBooking(
    supabase: ReturnType<typeof getSupabaseAdmin>,
    bookingId: string,
    input: SyncBookingParticipantsInput
): Promise<void> {
    const valor =
        input.valorPorParticipante != null && input.valorPorParticipante > 0
            ? input.valorPorParticipante
            : null
    const responsibleId = input.responsibleAthleteId ?? null
    const additional = Array.from(
        new Set(input.additionalAthleteIds.filter((id) => id && id !== responsibleId))
    )

    // Preserva membros de time (membro_time) criados pelo app.
    const { data: existingRows, error: existingError } = await supabase
        .from('booking_participants')
        .select('atleta_id, pago_em, valor')
        .eq('booking_id', bookingId)
        .in('funcao', ['responsavel', 'convidado'])

    if (existingError) throw new Error(existingError.message)

    const paidByAthlete = new Map(
        (existingRows ?? [])
            .filter((row) => row.pago_em)
            .map((row) => [row.atleta_id, row] as const)
    )

    const nextAthleteIds = new Set(
        [responsibleId, ...additional].filter((id): id is string => Boolean(id))
    )
    const removingPaid = (existingRows ?? []).filter(
        (row) => row.pago_em && !nextAthleteIds.has(row.atleta_id)
    )
    if (removingPaid.length > 0) {
        throw new Error('Não é possível remover participantes que já pagaram')
    }

    const { error: deleteError } = await supabase
        .from('booking_participants')
        .delete()
        .eq('booking_id', bookingId)
        .in('funcao', ['responsavel', 'convidado'])

    if (deleteError) throw new Error(deleteError.message)

    const rows: {
        booking_id: string
        atleta_id: string
        funcao: string
        status: string
        valor: number | null
        pago_em: string | null
    }[] = []

    const buildRow = (atletaId: string, funcao: string) => {
        const paid = paidByAthlete.get(atletaId)
        return {
            booking_id: bookingId,
            atleta_id: atletaId,
            funcao,
            status: 'confirmado',
            valor: paid?.valor ?? valor,
            pago_em: paid?.pago_em ?? null,
        }
    }

    if (responsibleId) {
        rows.push(buildRow(responsibleId, 'responsavel'))
    }

    for (const atletaId of additional) {
        rows.push(buildRow(atletaId, 'convidado'))
    }

    if (rows.length > 0) {
        const { error: insertError } = await supabase.from('booking_participants').insert(rows)
        if (insertError) throw new Error(insertError.message)
    }
}

export async function getParticipantSyncInputFromBooking(
    supabase: ReturnType<typeof getSupabaseAdmin>,
    bookingId: string,
    fallbackResponsibleId?: string | null
): Promise<SyncBookingParticipantsInput> {
    const { data: parts, error } = await supabase
        .from('booking_participants')
        .select('atleta_id, funcao')
        .eq('booking_id', bookingId)

    if (error) throw new Error(error.message)
    if (!parts?.length) {
        return {
            responsibleAthleteId: fallbackResponsibleId ?? null,
            additionalAthleteIds: [],
        }
    }

    const responsible =
        parts.find((p) => p.funcao === 'responsavel')?.atleta_id ??
        fallbackResponsibleId ??
        null

    const additional = parts
        .filter((p) => p.funcao === 'convidado')
        .map((p) => p.atleta_id)

    return { responsibleAthleteId: responsible, additionalAthleteIds: additional }
}

export async function syncBookingParticipantsAction(
    arenaId: string,
    bookingId: string,
    input: SyncBookingParticipantsInput
): Promise<{ success: boolean; error?: string }> {
    try {
        await assertArenaBackofficeAccess(arenaId)
        await assertBookingAccess(bookingId, arenaId)
        const supabase = getSupabaseAdmin()
        await syncBookingParticipantsForBooking(supabase, bookingId, input)
        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao salvar participantes'
        return { success: false, error: message }
    }
}
