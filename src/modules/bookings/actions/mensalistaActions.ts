"use server"

import { getSupabaseAdmin } from '@/lib/supabase-server'
import { assertArenaBackofficeAccess, requireAuthenticatedDbUser } from '@/lib/server-auth'
import { revalidatePath } from 'next/cache'
import { addDays, addMonths, startOfMonth, endOfMonth, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { PlanoMensalistaComDetalhes } from '@/modules/bookings/types/booking.types'

export interface CreatePlanoMensalistaInput {
  court_id: string
  athlete_id: string
  athlete_name: string
  sport_id?: string
  dia_semana: number
  horario_inicio: string
  horario_fim: string
  sessoes_por_mes: number
  valor_mensal: number
}

function generateDatesForMonth(
  year: number,
  month: number,
  diaSemana: number,
  sessoesPorMes: number
): Date[] {
  const dates: Date[] = []
  let current = startOfMonth(new Date(year, month, 1))
  const end = endOfMonth(new Date(year, month, 1))

  while (current.getDay() !== diaSemana) {
    current = addDays(current, 1)
  }

  while (current <= end && dates.length < sessoesPorMes) {
    dates.push(new Date(current))
    current = addDays(current, 7)
  }

  return dates
}

function buildDateTime(date: Date, timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number)
  const result = new Date(date)
  result.setHours(h, m, 0, 0)
  return result
}

function pricePerSession(valorMensal: number, sessoesPorMes: number): number {
  return Math.round((valorMensal / sessoesPorMes) * 100) / 100
}

async function createMensalistaTransaction(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  {
    arenaId,
    athleteId,
    athleteName,
    valorMensal,
    mesAno,
    registeredBy,
  }: {
    arenaId: string
    athleteId: string
    athleteName: string
    valorMensal: number
    mesAno: string
    registeredBy: string
  }
) {
  const today = new Date().toISOString().split('T')[0]
  const { error } = await supabase.from('transactions').insert({
    arena_id: arenaId,
    atleta_id: athleteId,
    type: 'entrada',
    category: 'Mensalidade',
    description: `Mensalidade - ${athleteName} - ${mesAno}`,
    unit_value: valorMensal,
    quantity: 1,
    total_value: valorMensal,
    discount: 0,
    launch_date: today,
    registration_date: today,
    registered_by: registeredBy,
    modo_pagamento_id: null,
  })
  if (error) throw new Error(`Erro ao registrar transação: ${error.message}`)
}

export async function createPlanoMensalistaAction(
  arenaId: string,
  input: CreatePlanoMensalistaInput
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertArenaBackofficeAccess(arenaId)
    const { dbUserId } = await requireAuthenticatedDbUser()
    const supabase = getSupabaseAdmin()

    const { data: plano, error: planoError } = await supabase
      .from('planos_mensalista')
      .insert({
        arena_id: arenaId,
        athlete_id: input.athlete_id,
        athlete_name: input.athlete_name,
        court_id: input.court_id,
        sport_id: input.sport_id || null,
        dia_semana: input.dia_semana,
        horario_inicio: input.horario_inicio,
        horario_fim: input.horario_fim,
        sessoes_por_mes: input.sessoes_por_mes,
        valor_mensal: input.valor_mensal,
        status: 'ativo',
        data_inicio: new Date().toISOString().split('T')[0],
      })
      .select()
      .single()

    if (planoError) throw new Error(planoError.message)

    const now = new Date()
    const bookingsToCreate = []

    for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
      const targetDate = addMonths(now, monthOffset)
      const year = targetDate.getFullYear()
      const month = targetDate.getMonth()
      const isCurrentMonth = monthOffset === 0
      const status = isCurrentMonth ? 'confirmed' : 'reservado'

      const dates = generateDatesForMonth(year, month, input.dia_semana, input.sessoes_por_mes)

      for (const date of dates) {
        const startTime = buildDateTime(date, input.horario_inicio)
        const endTime = buildDateTime(date, input.horario_fim)

        if (startTime < now) continue

        bookingsToCreate.push({
          arena_id: arenaId,
          court_id: input.court_id,
          athlete_id: input.athlete_id,
          athlete_name: input.athlete_name,
          sport_id: input.sport_id || null,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          status,
          // Confirmed: show price per session on calendar. Reservado: null (not paid yet)
          price: isCurrentMonth ? pricePerSession(input.valor_mensal, input.sessoes_por_mes) : null,
          booking_type: 'mensalista',
          plano_mensalista_id: plano.id,
          recurrence_id: null,
        })
      }
    }

    if (bookingsToCreate.length > 0) {
      const { error: bookingsError } = await supabase.from('bookings').insert(bookingsToCreate)
      if (bookingsError) throw new Error(bookingsError.message)
    }

    // Register payment for month 1 (current month — assumed received when plan is created)
    const currentMonthLabel = format(now, "MMMM/yyyy", { locale: ptBR })
    await createMensalistaTransaction(supabase, {
      arenaId,
      athleteId: input.athlete_id,
      athleteName: input.athlete_name,
      valorMensal: input.valor_mensal,
      mesAno: currentMonthLabel,
      registeredBy: dbUserId,
    })

    revalidatePath(`/dashboard/arenas/${arenaId}`)
    revalidatePath(`/dashboard/arenas/${arenaId}/courts`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao criar plano mensalista'
    return { success: false, error: message }
  }
}

export async function cancelPlanoMensalistaAction(
  arenaId: string,
  planoId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertArenaBackofficeAccess(arenaId)
    const supabase = getSupabaseAdmin()

    const { error: planoError } = await supabase
      .from('planos_mensalista')
      .update({ status: 'cancelado' })
      .eq('id', planoId)
      .eq('arena_id', arenaId)

    if (planoError) throw new Error(planoError.message)

    const now = new Date().toISOString()
    const { error: bookingsError } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('plano_mensalista_id', planoId)
      .eq('status', 'reservado')
      .gte('start_time', now)

    if (bookingsError) throw new Error(bookingsError.message)

    revalidatePath(`/dashboard/arenas/${arenaId}`)
    revalidatePath(`/dashboard/arenas/${arenaId}/courts`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao cancelar plano mensalista'
    return { success: false, error: message }
  }
}

export async function confirmarMesMensalistaAction(
  arenaId: string,
  planoId: string,
  valorOverride?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertArenaBackofficeAccess(arenaId)
    const { dbUserId } = await requireAuthenticatedDbUser()
    const supabase = getSupabaseAdmin()

    const { data: plano, error: planoError } = await supabase
      .from('planos_mensalista')
      .select('*')
      .eq('id', planoId)
      .eq('arena_id', arenaId)
      .single()

    if (planoError || !plano) throw new Error('Plano não encontrado')

    const valorEfetivo = valorOverride !== undefined && valorOverride > 0
      ? valorOverride
      : plano.valor_mensal

    // Find the earliest reservado month to confirm
    const { data: reservadoBookings, error: fetchError } = await supabase
      .from('bookings')
      .select('id, start_time')
      .eq('plano_mensalista_id', planoId)
      .eq('status', 'reservado')
      .order('start_time', { ascending: true })

    if (fetchError) throw new Error(fetchError.message)
    if (!reservadoBookings || reservadoBookings.length === 0) {
      throw new Error('Não há reservas pendentes para confirmar')
    }

    const earliestDate = new Date(reservadoBookings[0].start_time)
    const targetYear = earliestDate.getFullYear()
    const targetMonth = earliestDate.getMonth()

    const monthStart = startOfMonth(new Date(targetYear, targetMonth)).toISOString()
    const monthEnd = endOfMonth(new Date(targetYear, targetMonth)).toISOString()

    const { data: monthBookings, error: monthError } = await supabase
      .from('bookings')
      .select('id')
      .eq('plano_mensalista_id', planoId)
      .eq('status', 'reservado')
      .gte('start_time', monthStart)
      .lte('start_time', monthEnd)

    if (monthError) throw new Error(monthError.message)

    const ids = (monthBookings || []).map((b) => b.id)
    if (ids.length > 0) {
      // Confirm bookings and set price per session (now it's paid)
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          status: 'confirmed',
          price: pricePerSession(valorEfetivo, plano.sessoes_por_mes),
        })
        .in('id', ids)

      if (updateError) throw new Error(updateError.message)
    }

    // Register the payment transaction for this month
    const confirmedMonthLabel = format(new Date(targetYear, targetMonth, 1), "MMMM/yyyy", { locale: ptBR })
    await createMensalistaTransaction(supabase, {
      arenaId,
      athleteId: plano.athlete_id,
      athleteName: plano.athlete_name,
      valorMensal: valorEfetivo,
      mesAno: confirmedMonthLabel,
      registeredBy: dbUserId,
    })

    // Find latest remaining reservado to generate next month
    const { data: remainingReservado } = await supabase
      .from('bookings')
      .select('start_time')
      .eq('plano_mensalista_id', planoId)
      .eq('status', 'reservado')
      .order('start_time', { ascending: false })
      .limit(1)

    const latestDate =
      remainingReservado && remainingReservado.length > 0
        ? new Date(remainingReservado[0].start_time)
        : new Date(targetYear, targetMonth + 1, 1)

    const nextMonthDate = addMonths(latestDate, 1)
    const nextYear = nextMonthDate.getFullYear()
    const nextMonth = nextMonthDate.getMonth()

    const dates = generateDatesForMonth(nextYear, nextMonth, plano.dia_semana, plano.sessoes_por_mes)

    const newBookings = dates.map((date) => {
      const startTime = buildDateTime(date, plano.horario_inicio)
      const endTime = buildDateTime(date, plano.horario_fim)
      return {
        arena_id: arenaId,
        court_id: plano.court_id,
        athlete_id: plano.athlete_id,
        athlete_name: plano.athlete_name,
        sport_id: plano.sport_id,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: 'reservado' as const,
        price: null, // Not paid yet — price set only when confirmed
        booking_type: 'mensalista',
        plano_mensalista_id: planoId,
        recurrence_id: null,
      }
    })

    if (newBookings.length > 0) {
      const { error: insertError } = await supabase.from('bookings').insert(newBookings)
      if (insertError) throw new Error(insertError.message)
    }

    revalidatePath(`/dashboard/arenas/${arenaId}`)
    revalidatePath(`/dashboard/arenas/${arenaId}/courts`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao confirmar pagamento'
    return { success: false, error: message }
  }
}

export async function getPlanosMensalistaAction(
  arenaId: string,
  courtId?: string
): Promise<{ success: boolean; data?: PlanoMensalistaComDetalhes[]; error?: string }> {
  try {
    await assertArenaBackofficeAccess(arenaId)
    const supabase = getSupabaseAdmin()

    let query = supabase
      .from('planos_mensalista')
      .select('*, atleta:athlete_id(id, nome_perfil, telefone), sports:sport_id(id, name), court:court_id(id, name)')
      .eq('arena_id', arenaId)
      .eq('status', 'ativo')

    if (courtId) {
      query = (query as any).eq('court_id', courtId)
    }

    const { data, error } = await (query as any).order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    const now = new Date().toISOString()
    const planosWithNext = await Promise.all(
      (data || []).map(async (plano: any) => {
        const { data: nextReservado } = await supabase
          .from('bookings')
          .select('start_time')
          .eq('plano_mensalista_id', plano.id)
          .eq('status', 'reservado')
          .gte('start_time', now)
          .order('start_time', { ascending: true })
          .limit(1)

        return {
          ...plano,
          proximo_mes_reservado: nextReservado?.[0]?.start_time || null,
        } as PlanoMensalistaComDetalhes
      })
    )

    return { success: true, data: planosWithNext }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar mensalistas'
    return { success: false, error: message }
  }
}
