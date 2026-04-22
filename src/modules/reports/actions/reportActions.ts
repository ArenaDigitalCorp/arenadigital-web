"use server"

import { getSupabaseAdmin } from '@/lib/supabase-server'
import { assertArenaBackofficeAccess } from '@/lib/server-auth'
import type {
  PaymentStatusRow,
  PaymentStatusSummary,
  CourtFilter,
  SportFilter,
  PaymentStatusFilters,
} from '@/modules/reports/types/report.types'

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
    await assertArenaBackofficeAccess(arenaId)
    const supabase = getSupabaseAdmin()

    let query = supabase
      .from('bookings')
      .select('id, start_time, status, price, plano_mensalista_id, sport_id, courts(id, name), sports(id, name), atleta:athlete_id(id, nome_perfil)')
      .eq('arena_id', arenaId)
      .order('start_time', { ascending: false })

    if (filters.startDate) query = query.gte('start_time', filters.startDate)
    if (filters.endDate) query = query.lte('start_time', filters.endDate + 'T23:59:59')
    if (filters.courtId) query = query.eq('court_id', filters.courtId)
    if (filters.sportId) query = query.eq('sport_id', filters.sportId)
    if (filters.tipo === 'avulso') query = query.is('plano_mensalista_id', null)
    if (filters.tipo === 'mensal') query = query.not('plano_mensalista_id', 'is', null)

    const [bookingsResult, courtsResult, sportsResult] = await Promise.all([
      query,
      supabase.from('courts').select('id, name').eq('arena_id', arenaId).order('name'),
      supabase
        .from('court_sports')
        .select('sports(id, name)')
        .in('court_id',
          (await supabase.from('courts').select('id').eq('arena_id', arenaId)).data?.map(c => c.id) ?? []
        ),
    ])

    if (bookingsResult.error) throw new Error(bookingsResult.error.message)

    const rows: PaymentStatusRow[] = (bookingsResult.data ?? []).map((b: any) => {
      let status: PaymentStatusRow['status'] = 'Pendente'
      if (b.status === 'confirmed') status = 'Pago'
      else if (b.status === 'cancelled') status = 'Cancelado'

      return {
        id: b.id,
        data: b.start_time,
        atleta: b.atleta?.nome_perfil ?? null,
        servico: b.plano_mensalista_id ? 'Mensal' : 'Avulso',
        espaco: b.courts?.name ?? null,
        esporte: b.sports?.name ?? null,
        valor: b.price ?? null,
        status,
      }
    })

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
