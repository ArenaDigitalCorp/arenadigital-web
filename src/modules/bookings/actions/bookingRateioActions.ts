'use server'

import { revalidatePath } from 'next/cache'
import { ZodError } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import {
  assertArenaBackofficeAccess,
  assertArenaScopedResourceAccess,
  assertBookingAccess,
  requireAuthenticatedDbUser,
} from '@/lib/server-auth'
import {
  locacaoDoRateio,
  sortCobrancas,
  toBookingCobranca,
  type BookingCobranca,
} from '@/modules/bookings/lib/booking-rateio'
import {
  adicionarParticipanteRateioSchema,
  atualizarValoresRateioSchema,
  configurarRateioSchema,
  registrarPagamentoRateioSchema,
  removerParticipanteRateioSchema,
  type AdicionarParticipanteRateioInput,
  type AtualizarValoresRateioInput,
  type RegistrarPagamentoRateioInput,
} from '@/modules/bookings/schemas/booking-rateio.schema'

/** Estado do rateio de uma reserva depois de cada operação. */
export type RateioSnapshot = {
  bookingId: string
  bookingStatus: string
  rateioAtivo: boolean
  rentalPrice: number
  cobrancas: BookingCobranca[]
}

/** Os tipos gerados marcam parâmetros opcionais das RPCs como obrigatórios; `null` é aceito. */
const rpcNullable = <T,>(value: T | null): T => value as T

type ActionResult<T> = { success: true; data: T } | { success: false; error: string }

function revalidateRateioPaths(arenaId: string) {
  revalidatePath(`/dashboard/arenas/${arenaId}/avulsas`)
  revalidatePath(`/dashboard/arenas/${arenaId}`)
  revalidatePath(`/dashboard/arenas/${arenaId}/courts`)
  revalidatePath(`/dashboard/finance/${arenaId}`)
  revalidatePath(`/dashboard/reports/${arenaId}/status-pagamentos`)
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ZodError) return err.issues[0]?.message ?? fallback
  return err instanceof Error ? err.message : fallback
}

async function loadSnapshot(arenaId: string, bookingId: string): Promise<RateioSnapshot> {
  const { data, error } = await getSupabaseAdmin()
    .from('bookings')
    .select(
      'id, status, cobranca_por_participante, rental_price, price, booking_cobrancas(id, atleta_id, nome, responsavel, valor_devido, valor_servicos, valor_pago, status, pago_em)'
    )
    .eq('id', bookingId)
    .eq('arena_id', arenaId)
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Reserva não encontrada')

  const row = data as unknown as {
    id: string
    status: string | null
    cobranca_por_participante: boolean | null
    rental_price: number | null
    price: number | null
    booking_cobrancas: Record<string, unknown>[] | null
  }

  const cobrancas = sortCobrancas((row.booking_cobrancas ?? []).map(toBookingCobranca))
  return {
    bookingId: row.id,
    bookingStatus: row.status ?? 'reservado',
    rateioAtivo: Boolean(row.cobranca_por_participante),
    rentalPrice: row.cobranca_por_participante
      ? locacaoDoRateio(row, cobrancas)
      : Number(row.rental_price ?? row.price ?? 0),
    cobrancas,
  }
}

async function bookingIdOfCobranca(arenaId: string, cobrancaId: string): Promise<string> {
  await assertArenaScopedResourceAccess('booking_cobrancas', cobrancaId, {
    expectedArenaId: arenaId,
    notFoundMessage: 'Participante do rateio não encontrado',
  })
  const { data, error } = await getSupabaseAdmin()
    .from('booking_cobrancas')
    .select('booking_id')
    .eq('id', cobrancaId)
    .single()
  if (error || !data) throw new Error('Participante do rateio não encontrado')
  return data.booking_id
}

export async function getRateioAction(
  arenaId: string,
  bookingId: string
): Promise<ActionResult<RateioSnapshot>> {
  try {
    await assertArenaBackofficeAccess(arenaId)
    await assertBookingAccess(bookingId, arenaId)
    return { success: true, data: await loadSnapshot(arenaId, bookingId) }
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Erro ao carregar o rateio') }
  }
}

export async function configurarRateioAction(input: {
  arenaId: string
  bookingId: string
  ativo: boolean
}): Promise<ActionResult<RateioSnapshot>> {
  try {
    const parsed = configurarRateioSchema.parse(input)
    await assertArenaBackofficeAccess(parsed.arenaId)
    await assertBookingAccess(parsed.bookingId, parsed.arenaId)
    const { dbUserId } = await requireAuthenticatedDbUser()

    const { error } = await getSupabaseAdmin().rpc('configure_booking_rateio_atomic', {
      p_arena_id: parsed.arenaId,
      p_booking_id: parsed.bookingId,
      p_ativo: parsed.ativo,
      p_registered_by: dbUserId,
    })
    if (error) throw new Error(error.message)

    revalidateRateioPaths(parsed.arenaId)
    return { success: true, data: await loadSnapshot(parsed.arenaId, parsed.bookingId) }
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Erro ao configurar o rateio') }
  }
}

export async function adicionarParticipanteRateioAction(
  input: AdicionarParticipanteRateioInput
): Promise<ActionResult<RateioSnapshot>> {
  try {
    const parsed = adicionarParticipanteRateioSchema.parse(input)
    await assertArenaBackofficeAccess(parsed.arenaId)
    await assertBookingAccess(parsed.bookingId, parsed.arenaId)
    const { dbUserId } = await requireAuthenticatedDbUser()

    const { error } = await getSupabaseAdmin().rpc('add_booking_rateio_participante_atomic', {
      p_arena_id: parsed.arenaId,
      p_booking_id: parsed.bookingId,
      p_atleta_id: rpcNullable(parsed.atletaId),
      p_nome: rpcNullable(parsed.nome || null),
      p_valor: parsed.valor,
      p_registered_by: dbUserId,
    })
    if (error) throw new Error(error.message)

    revalidateRateioPaths(parsed.arenaId)
    return { success: true, data: await loadSnapshot(parsed.arenaId, parsed.bookingId) }
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Erro ao adicionar participante') }
  }
}

export async function atualizarValoresRateioAction(
  input: AtualizarValoresRateioInput
): Promise<ActionResult<RateioSnapshot>> {
  try {
    const parsed = atualizarValoresRateioSchema.parse(input)
    await assertArenaBackofficeAccess(parsed.arenaId)
    await assertBookingAccess(parsed.bookingId, parsed.arenaId)
    const { dbUserId } = await requireAuthenticatedDbUser()

    const { error } = await getSupabaseAdmin().rpc('update_booking_rateio_valores_atomic', {
      p_arena_id: parsed.arenaId,
      p_booking_id: parsed.bookingId,
      p_valores: parsed.valores.map((v) => ({ cobranca_id: v.cobrancaId, valor: v.valor })),
      p_registered_by: dbUserId,
    })
    if (error) throw new Error(error.message)

    revalidateRateioPaths(parsed.arenaId)
    return { success: true, data: await loadSnapshot(parsed.arenaId, parsed.bookingId) }
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Erro ao atualizar os valores') }
  }
}

export async function removerParticipanteRateioAvulsoAction(input: {
  arenaId: string
  cobrancaId: string
}): Promise<ActionResult<RateioSnapshot & { valorRevertido: number }>> {
  try {
    const parsed = removerParticipanteRateioSchema.parse(input)
    await assertArenaBackofficeAccess(parsed.arenaId)
    const bookingId = await bookingIdOfCobranca(parsed.arenaId, parsed.cobrancaId)
    const { dbUserId } = await requireAuthenticatedDbUser()

    const { data, error } = await getSupabaseAdmin().rpc(
      'remove_booking_rateio_participante_atomic',
      {
        p_arena_id: parsed.arenaId,
        p_cobranca_id: parsed.cobrancaId,
        p_registered_by: dbUserId,
      }
    )
    if (error) throw new Error(error.message)

    const valorRevertido = Number(
      (data as { valor_revertido?: number | string } | null)?.valor_revertido ?? 0
    )
    revalidateRateioPaths(parsed.arenaId)
    return {
      success: true,
      data: { ...(await loadSnapshot(parsed.arenaId, bookingId)), valorRevertido },
    }
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Erro ao remover participante') }
  }
}

export async function registrarPagamentoRateioAction(
  input: RegistrarPagamentoRateioInput
): Promise<ActionResult<RateioSnapshot>> {
  try {
    const parsed = registrarPagamentoRateioSchema.parse(input)
    await assertArenaBackofficeAccess(parsed.arenaId)
    const bookingId = await bookingIdOfCobranca(parsed.arenaId, parsed.cobrancaId)
    const { dbUserId } = await requireAuthenticatedDbUser()

    const { error } = await getSupabaseAdmin().rpc('register_booking_cobranca_payment_atomic', {
      p_operation_id: parsed.operationId,
      p_arena_id: parsed.arenaId,
      p_cobranca_id: parsed.cobrancaId,
      p_valor: parsed.valor,
      p_data: parsed.data,
      p_modo_pagamento_id: rpcNullable(parsed.modoPagamentoId),
      p_observacao: rpcNullable(parsed.observacao || null),
      p_registered_by: dbUserId,
    })
    if (error) throw new Error(error.message)

    revalidateRateioPaths(parsed.arenaId)
    return { success: true, data: await loadSnapshot(parsed.arenaId, bookingId) }
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Erro ao registrar pagamento') }
  }
}
