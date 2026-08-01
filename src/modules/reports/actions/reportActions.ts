"use server"

import { getSupabaseAdmin } from '@/lib/supabase-server'
import { assertArenaAdminAccess } from '@/lib/server-auth'
import { fetchAllSupabaseRows } from '@/lib/supabase-pagination'
import type {
  PaymentStatusRow,
  PaymentStatusSummary,
  CourtFilter,
  SportFilter,
  PaymentStatusFilters,
} from '@/modules/reports/types/report.types'
import {
  resolveReportSourceFlags,
  shouldIncludeBookingRow,
  shouldIncludeTransactionRow,
} from '@/modules/reports/payment-report-sources'

async function getStationTypeNames(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<string[]> {
  const { data: stationTypes } = await supabase.from('station_types').select('name')
  return (stationTypes ?? [])
    .map((row) => row.name)
    .filter((name): name is string => typeof name === 'string' && name.length > 0)
}

export async function getPaymentStatusReportAction(
  arenaId: string,
  filters: PaymentStatusFilters = {}
): Promise<{
  success: boolean
  rows?: PaymentStatusRow[]
  summary?: PaymentStatusSummary
  courts?: CourtFilter[]
  sports?: SportFilter[]
  error?: string
}> {
  try {
    await assertArenaAdminAccess(arenaId)
    const supabase = getSupabaseAdmin()

    let query = supabase
      .from('bookings')
      .select('id, start_time, status, price, plano_mensalista_id, sport_id, cobranca_por_participante, courts(id, name), sports(id, name), atleta:athlete_id(id, nome_perfil), booking_participants(id, funcao, pago_em, valor)')
      .eq('arena_id', arenaId)
      .order('start_time', { ascending: false })
      .order('id', { ascending: false })

    if (filters.startDate) query = query.gte('start_time', filters.startDate)
    if (filters.endDate) query = query.lte('start_time', filters.endDate + 'T23:59:59')
    if (filters.courtId) query = query.eq('court_id', filters.courtId)
    if (filters.sportId) query = query.eq('sport_id', filters.sportId)
    if (filters.tipo === 'avulso') query = query.is('plano_mensalista_id', null)
    if (filters.tipo === 'mensal') query = query.not('plano_mensalista_id', 'is', null)

    let stationPaymentsQuery = supabase
      .from('station_payments')
      .select(`
        id,
        amount,
        payment_method,
        paid_by_name,
        created_at,
        station_orders!inner(
          arena_id,
          order_number,
          status,
          customer_name,
          atleta:atleta(nome_perfil),
          station:stations(name, station_type:station_types(name))
        )
      `)
      .eq('station_orders.arena_id', arenaId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })

    if (filters.startDate) stationPaymentsQuery = stationPaymentsQuery.gte('created_at', filters.startDate)
    if (filters.endDate) stationPaymentsQuery = stationPaymentsQuery.lte('created_at', filters.endDate + 'T23:59:59')

    let rotativoInscricoesQuery = supabase
      .from('rotativo_inscricoes')
      .select(`
        id,
        valor_pago,
        data_inscricao,
        tipo_pagamento,
        atleta:id_atleta(nome_perfil),
        modo_pagamento:modo_pagamento_id(nome),
        rotativo:rotativos!inner(
          id_arena,
          status,
          data,
          esporte:id_esporte(name)
        )
      `)
      .eq('tipo_pagamento', 'avulso')
      .eq('rotativo.id_arena', arenaId)
      .order('data_inscricao', { ascending: false })
      .order('id', { ascending: false })

    if (filters.startDate) rotativoInscricoesQuery = rotativoInscricoesQuery.gte('data_inscricao', filters.startDate)
    if (filters.endDate) rotativoInscricoesQuery = rotativoInscricoesQuery.lte('data_inscricao', filters.endDate + 'T23:59:59')
    if (filters.sportId) rotativoInscricoesQuery = rotativoInscricoesQuery.eq('rotativo.id_esporte', filters.sportId)

    let rotativoCreditosQuery = supabase
      .from('rotativo_credito_movimentos')
      .select(`
        id,
        quantidade,
        valor_pago,
        created_at,
        atleta:atleta_id(nome_perfil),
        modo_pagamento:modo_pagamento_id(nome)
      `)
      .eq('arena_id', arenaId)
      .eq('tipo', 'compra')
      .not('valor_pago', 'is', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })

    if (filters.startDate) rotativoCreditosQuery = rotativoCreditosQuery.gte('created_at', filters.startDate)
    if (filters.endDate) rotativoCreditosQuery = rotativoCreditosQuery.lte('created_at', filters.endDate + 'T23:59:59')

    const sourceFlags = resolveReportSourceFlags(filters)
    const stationTypeNames = await getStationTypeNames(supabase)

    let transactionsQuery = supabase
      .from('transactions')
      .select(`
        id,
        category,
        description,
        total_value,
        launch_date,
        atleta:atleta_id(nome_perfil),
        modo_pagamento:modo_pagamento_id(nome)
      `)
      .eq('arena_id', arenaId)
      .eq('type', 'entrada')
      .order('launch_date', { ascending: false })
      .order('id', { ascending: false })

    if (filters.startDate) transactionsQuery = transactionsQuery.gte('launch_date', filters.startDate)
    if (filters.endDate) transactionsQuery = transactionsQuery.lte('launch_date', filters.endDate)

    const [bookingsResult, courtsResult, sportsResult, stationPaymentsResult, rotativoInscricoesResult, rotativoCreditosResult, transactionsResult] = await Promise.all([
      fetchAllSupabaseRows(query),
      supabase.from('courts').select('id, name').eq('arena_id', arenaId).order('name'),
      supabase
        .from('court_sports')
        .select('sports(id, name)')
        .in('court_id',
          (await supabase.from('courts').select('id').eq('arena_id', arenaId)).data?.map(c => c.id) ?? []
        ),
      sourceFlags.includeStationPayments ? fetchAllSupabaseRows(stationPaymentsQuery) : Promise.resolve({ data: [], error: null }),
      sourceFlags.includeRotativoInscricoes ? fetchAllSupabaseRows(rotativoInscricoesQuery) : Promise.resolve({ data: [], error: null }),
      sourceFlags.includeRotativoCreditos ? fetchAllSupabaseRows(rotativoCreditosQuery) : Promise.resolve({ data: [], error: null }),
      sourceFlags.includeTransactions ? fetchAllSupabaseRows(transactionsQuery) : Promise.resolve({ data: [], error: null }),
    ])

    // Bookings é a fonte principal e de onde vêm os filtros — se falhar, o relatório não tem como funcionar.
    if (bookingsResult.error) throw new Error(bookingsResult.error.message)

    // Fontes complementares: uma falha isolada (ex.: relacionamento inválido) não deve
    // derrubar o relatório inteiro. Registra o erro e segue com as demais fontes.
    const logSourceError = (source: string, error: { message: string } | null) => {
      if (error) console.error(`[getPaymentStatusReportAction] Falha na fonte "${source}": ${error.message}`)
    }
    logSourceError('station_payments', stationPaymentsResult.error)
    logSourceError('rotativo_inscricoes', rotativoInscricoesResult.error)
    logSourceError('rotativo_creditos', rotativoCreditosResult.error)
    logSourceError('transactions', transactionsResult.error)

    const bookingRows: PaymentStatusRow[] = (bookingsResult.data ?? [])
      .filter((b: any) => shouldIncludeBookingRow(b))
      .map((b: any) => {
        let status: PaymentStatusRow['status'] = 'Pendente'
        if (b.status === 'confirmed') status = 'Pago'
        else if (b.status === 'cancelled') status = 'Cancelado'

        const billingParticipants = (b.booking_participants ?? []).filter(
          (p: { funcao?: string }) => p.funcao === 'responsavel' || p.funcao === 'convidado'
        )
        let valor: number | null = b.price ?? null
        if (b.cobranca_por_participante && billingParticipants.length > 0) {
          if (b.status === 'reservado') {
            const unpaid = billingParticipants.filter((p: { pago_em?: string | null }) => !p.pago_em)
            valor = unpaid.reduce(
              (sum: number, p: { valor?: number | null }) =>
                sum + Number(p.valor ?? b.price ?? 0),
              0
            )
          } else {
            valor = billingParticipants.reduce(
              (sum: number, p: { valor?: number | null }) =>
                sum + Number(p.valor ?? b.price ?? 0),
              0
            )
          }
        }

        return {
          id: b.id,
          data: b.start_time,
          atleta: b.atleta?.nome_perfil ?? null,
          servico: b.plano_mensalista_id ? 'Mensal' : 'Avulso',
          espaco: b.courts?.name ?? null,
          esporte: b.sports?.name ?? null,
          valor,
          status,
        }
      })

    const stationPaymentRows: PaymentStatusRow[] = (stationPaymentsResult.data ?? []).map((payment: any) => {
      const order = payment.station_orders
      const station = order?.station
      const stationTypeName = station?.station_type?.name ?? null

      let status: PaymentStatusRow['status'] = 'Pago'
      if (order?.status === 'cancelled') status = 'Cancelado'

      return {
        id: `station-payment-${payment.id}`,
        data: payment.created_at,
        atleta: payment.paid_by_name ?? order?.atleta?.nome_perfil ?? order?.customer_name ?? null,
        servico: 'Comanda',
        espaco: station?.name ?? stationTypeName,
        esporte: payment.payment_method ?? null,
        valor: payment.amount ?? null,
        status,
      }
    })

    const rotativoInscricaoRows: PaymentStatusRow[] = (rotativoInscricoesResult.data ?? []).map((inscricao: any) => {
      const rotativo = inscricao.rotativo
      let status: PaymentStatusRow['status'] = 'Pago'
      if (rotativo?.status === 'desativado') status = 'Cancelado'

      return {
        id: `rotativo-inscricao-${inscricao.id}`,
        data: inscricao.data_inscricao,
        atleta: inscricao.atleta?.nome_perfil ?? null,
        servico: 'Rotativo',
        espaco: rotativo?.esporte?.name ?? null,
        esporte: inscricao.modo_pagamento?.nome ?? null,
        valor: inscricao.valor_pago ?? null,
        status,
      }
    })

    const rotativoCreditoRows: PaymentStatusRow[] = (rotativoCreditosResult.data ?? []).map((mov: any) => ({
      id: `rotativo-credito-${mov.id}`,
      data: mov.created_at,
      atleta: mov.atleta?.nome_perfil ?? null,
      servico: 'Crédito rotativo',
      espaco: `${mov.quantidade} crédito${mov.quantidade !== 1 ? 's' : ''}`,
      esporte: mov.modo_pagamento?.nome ?? null,
      valor: mov.valor_pago ?? null,
      status: 'Pago' as const,
    }))

    const transactionRows: PaymentStatusRow[] = (transactionsResult.data ?? [])
      .filter((t: any) =>
        shouldIncludeTransactionRow(t.category ?? '', t.description, sourceFlags.mode, stationTypeNames)
      )
      .map((t: any) => ({
      id: `transaction-${t.id}`,
      data: t.launch_date,
      atleta: t.atleta?.nome_perfil ?? null,
      servico: t.category === 'Mensalidade' ? 'Mensalista' : 'Entrada Manual',
      espaco: t.category === 'Mensalidade' ? (t.description ?? null) : (t.category ?? null),
      esporte: t.modo_pagamento?.nome ?? null,
      valor: t.total_value ?? null,
      status: 'Pago' as const,
    }))

    const rows: PaymentStatusRow[] = [
      ...bookingRows,
      ...stationPaymentRows,
      ...rotativoInscricaoRows,
      ...rotativoCreditoRows,
      ...transactionRows,
    ].sort(
      (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
    )

    const summary: PaymentStatusSummary = rows.reduce(
      (acc, r) => {
        if (r.status === 'Pago') {
          acc.totalPago += r.valor ?? 0
          acc.countPago++
        } else if (r.status === 'Pendente') {
          acc.totalPendente += r.valor ?? 0
          acc.countPendente++
        } else if (r.status === 'Cancelado') {
          acc.totalCancelado += r.valor ?? 0
          acc.countCancelado++
        }
        return acc
      },
      { totalPago: 0, totalPendente: 0, totalCancelado: 0, countPago: 0, countPendente: 0, countCancelado: 0 }
    )

    const courts: CourtFilter[] = courtsResult.data ?? []

    const sportsMap = new Map<string, SportFilter>()
    for (const item of sportsResult.data ?? []) {
      const s = Array.isArray(item.sports) ? item.sports[0] : item.sports
      if (s?.id) sportsMap.set(s.id, { id: s.id, name: s.name })
    }
    const sports: SportFilter[] = [...sportsMap.values()]

    return { success: true, rows, summary, courts, sports }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar relatório'
    return { success: false, error: message }
  }
}
