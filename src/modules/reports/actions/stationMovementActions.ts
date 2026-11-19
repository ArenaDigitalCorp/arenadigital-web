"use server"

import { getSupabaseAdmin } from '@/lib/supabase-server'
import { assertArenaResourceAccess } from '@/lib/server-auth'
import { fetchAllSupabaseRows } from '@/lib/supabase-pagination'
import type {
  StationMovementRow,
  StationMovementFilters,
  StationFilterOption,
} from '@/modules/reports/types/station-movement.types'

const MOVEMENT_SELECT = `
  id,
  order_number,
  created_at,
  customer_name,
  station_id,
  status,
  pending_marked_at,
  total_value,
  station:stations!station_orders_station_id_fkey(name),
  atleta:atleta(nome_perfil),
  station_payments(payment_method, amount)
`

export async function getStationMovementReportAction(
  arenaId: string,
  filters: StationMovementFilters = {}
): Promise<{
  success: boolean
  rows?: StationMovementRow[]
  stations?: StationFilterOption[]
  error?: string
}> {
  try {
    const access = await assertArenaResourceAccess(arenaId, 'reports.stations')
    if (access.role === 'Caixa' && !access.assignedStationId) {
      return { success: true, rows: [], stations: [] }
    }
    const supabase = getSupabaseAdmin()

    let query = supabase
      .from('station_orders')
      .select(MOVEMENT_SELECT)
      .eq('arena_id', arenaId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })

    let stationsQuery = supabase.from('stations').select('id, name').eq('arena_id', arenaId).order('name', { ascending: true })
    if (access.role === 'Caixa' && access.assignedStationId) {
      query = query.eq('station_id', access.assignedStationId)
      stationsQuery = stationsQuery.eq('id', access.assignedStationId)
    }

    if (filters.startDate) query = query.gte('created_at', filters.startDate)
    if (filters.endDate) query = query.lte('created_at', filters.endDate + 'T23:59:59')
    if (filters.stationId) query = query.eq('station_id', filters.stationId)
    if (filters.status) query = query.eq('status', filters.status)

    const term = (filters.customer ?? '').trim()
    const safe = term.replace(/[,()"\\]/g, ' ').replace(/\s+/g, ' ').trim()
    if (safe) {
      const conditions = [`customer_name.ilike."*${safe}*"`]
      const { data: atletas, error: atletaError } = await supabase
        .from('atleta')
        .select('id')
        .ilike('nome_perfil', `%${safe}%`)
        .limit(200)
      if (atletaError) throw new Error(atletaError.message)
      const atletaIds = (atletas ?? []).map((a) => a.id)
      if (atletaIds.length > 0) conditions.push(`atleta_id.in.(${atletaIds.join(',')})`)
      query = query.or(conditions.join(','))
    }

    const [ordersResult, stationsResult] = await Promise.all([
      term && !safe ? { data: [], error: null } : fetchAllSupabaseRows(query),
      stationsQuery,
    ])

    if (ordersResult.error) throw new Error(ordersResult.error.message)
    if (stationsResult.error) throw new Error(stationsResult.error.message)

    type OrderRow = {
      id: string
      order_number: number
      created_at: string
      customer_name: string | null
      station_id: string
      status: StationMovementRow['status']
      pending_marked_at: string | null
      total_value: number | null
      station: { name: string | null } | null
      atleta: { nome_perfil: string | null } | null
      station_payments: { payment_method: string; amount: number }[] | null
    }

    let rows: StationMovementRow[] = ((ordersResult.data ?? []) as unknown as OrderRow[]).map((order) => {
      const payments = (order.station_payments ?? []) as { payment_method: string; amount: number }[]
      const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0)
      const methods = [...new Set(payments.map((p) => p.payment_method).filter(Boolean))]

      let paymentStatus: StationMovementRow['payment_status'] = 'pendente'
      if (totalPaid >= Number(order.total_value ?? 0) && totalPaid > 0) paymentStatus = 'pago'
      else if (totalPaid > 0) paymentStatus = 'parcial'

      return {
        id: order.id,
        order_number: order.order_number,
        created_at: order.created_at,
        customer_name: order.customer_name ?? order.atleta?.nome_perfil ?? null,
        station_id: order.station_id,
        station_name: order.station?.name ?? null,
        status: order.status,
        pending_marked_at: order.pending_marked_at ?? null,
        payment_method: methods.length > 0 ? methods.join(', ') : null,
        payment_status: paymentStatus,
        total_value: order.total_value ?? 0,
      }
    })

    if (filters.paymentMethod) {
      rows = rows.filter((r) => (r.payment_method ?? '').includes(filters.paymentMethod as string))
    }
    if (filters.paymentStatus) {
      rows = rows.filter((r) => r.payment_status === filters.paymentStatus)
    }

    const stations: StationFilterOption[] = stationsResult.data ?? []

    return { success: true, rows, stations }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar relatório de movimentação de estações'
    return { success: false, error: message }
  }
}
