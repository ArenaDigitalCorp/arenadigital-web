"use server"

import { getSupabaseAdmin } from '@/lib/supabase-server'
import { assertArenaAccess, assertArenaAdminAccess, assertArenaBackofficeAccess, assertStationAccess } from '@/lib/server-auth'
import { fetchAllSupabaseRows } from '@/lib/supabase-pagination'
import type { StationOrdersFilters } from '@/modules/stations/types/station.types'

export async function getStationsWithMetricsAction(arenaId: string) {
    try {
        const access = await assertArenaAccess(arenaId)
        const supabase = getSupabaseAdmin()

        if (!access.isOwner && access.role === 'Caixa' && !access.assignedStationId) {
            throw new Error('Caixa sem estação vinculada')
        }

        let stationsQuery = supabase
            .from('stations')
            .select(`*, station_type:station_types(*)`)
            .eq('arena_id', arenaId)
            .order('created_at', { ascending: false })

        if (!access.isOwner && access.role === 'Caixa' && access.assignedStationId) {
            stationsQuery = stationsQuery.eq('id', access.assignedStationId)
        }

        const { data: stations, error } = await stationsQuery

        if (error) throw new Error(error.message)
        if (!stations || stations.length === 0) return { success: true, data: [] }

        const stationIds = stations.map(s => s.id)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayISO = today.toISOString()

        const [openRes, closedRes] = await Promise.all([
            fetchAllSupabaseRows(supabase
                .from('station_orders')
                .select('station_id, created_at')
                .in('station_id', stationIds)
                .eq('status', 'open')
                .order('id', { ascending: true })),
            fetchAllSupabaseRows(supabase
                .from('station_orders')
                .select('station_id')
                .in('station_id', stationIds)
                .eq('status', 'closed')
                .gte('closed_at', todayISO)
                .order('id', { ascending: true })),
        ])

        const metrics: Record<string, { pending: number; closedToday: number; openedToday: number }> = {}
        for (const sid of stationIds) metrics[sid] = { pending: 0, closedToday: 0, openedToday: 0 }

        for (const row of openRes.data ?? []) {
            const sid = row.station_id as string
            if (!metrics[sid]) continue
            metrics[sid].pending += 1
            if (row.created_at >= todayISO) metrics[sid].openedToday += 1
        }
        for (const row of closedRes.data ?? []) {
            const sid = row.station_id as string
            if (!metrics[sid]) continue
            metrics[sid].closedToday += 1
        }

        const data = stations.map(station => ({ ...station, metrics: metrics[station.id] }))
        return { success: true, data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar estações'
        return { success: false, error: message, data: [] }
    }
}

const ORDERS_SELECT = `*, atleta:atleta(nome_perfil), station_order_items(*, product:products(name))`
const ORDERS_PAGE_SIZES = [10, 25, 50, 100]
const ORDERS_DEFAULT_PAGE_SIZE = 25

async function queryStationOrders(arenaId: string, stationId: string, filters: StationOrdersFilters) {
    const supabase = getSupabaseAdmin()
    const page = Math.max(1, Math.trunc(filters.page ?? 1))
    const pageSize = ORDERS_PAGE_SIZES.includes(filters.pageSize ?? ORDERS_DEFAULT_PAGE_SIZE)
        ? (filters.pageSize ?? ORDERS_DEFAULT_PAGE_SIZE)
        : ORDERS_DEFAULT_PAGE_SIZE

    let query = supabase
        .from('station_orders')
        .select(ORDERS_SELECT, { count: 'exact' })
        .eq('station_id', stationId)
        .eq('arena_id', arenaId)

    if (filters.status && filters.status !== 'todos') query = query.eq('status', filters.status)
    if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom)
    if (filters.dateTo) query = query.lte('created_at', filters.dateTo)

    const term = (filters.search ?? '').trim()
    if (term) {
        // caracteres com significado especial na sintaxe `or` do PostgREST
        const safe = term.replace(/[,()"\\]/g, ' ').replace(/\s+/g, ' ').trim()
        const conditions: string[] = []
        if (safe) {
            conditions.push(`customer_name.ilike."*${safe}*"`)
            const { data: atletas, error: atletaError } = await supabase
                .from('atleta')
                .select('id')
                .ilike('nome_perfil', `%${safe}%`)
                .limit(200)
            if (atletaError) throw new Error(atletaError.message)
            const atletaIds = (atletas ?? []).map(a => a.id)
            if (atletaIds.length > 0) conditions.push(`atleta_id.in.(${atletaIds.join(',')})`)
        }
        if (/^\d+$/.test(safe)) conditions.push(`order_number.eq.${safe}`)
        if (conditions.length === 0) return { orders: [], total: 0 }
        query = query.or(conditions.join(','))
    }

    const from = (page - 1) * pageSize
    const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1)

    if (error) {
        // range além do total de registros (ex.: filtros mudaram entre requisições)
        if (error.code === 'PGRST103') return { orders: [], total: 0 }
        throw new Error(error.message)
    }
    return { orders: data ?? [], total: count ?? 0 }
}

export async function getStationWithOrdersAction(arenaId: string, stationId: string, filters: StationOrdersFilters = {}) {
    try {
        await assertStationAccess(stationId, arenaId)
        const supabase = getSupabaseAdmin()

        const [stationRes, ordersRes] = await Promise.all([
            supabase
                .from('stations')
                .select(`*, station_type:station_types(*)`)
                .eq('id', stationId)
                .eq('arena_id', arenaId)
                .single(),
            queryStationOrders(arenaId, stationId, filters),
        ])

        if (stationRes.error) throw new Error(stationRes.error.message)

        return { success: true, station: stationRes.data, orders: ordersRes.orders, total: ordersRes.total }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar estação'
        return { success: false, error: message, station: null, orders: [], total: 0 }
    }
}

export async function getOrdersByStationAction(arenaId: string, stationId: string, filters: StationOrdersFilters = {}) {
    try {
        await assertStationAccess(stationId, arenaId)
        const { orders, total } = await queryStationOrders(arenaId, stationId, filters)
        return { success: true, data: orders, total }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar comandas'
        return { success: false, error: message, data: [], total: 0 }
    }
}

export async function getStationByIdAction(arenaId: string, stationId: string) {
    try {
        await assertStationAccess(stationId, arenaId)
        const { data, error } = await getSupabaseAdmin()
            .from('stations')
            .select(`*, station_type:station_types(*)`)
            .eq('id', stationId)
            .eq('arena_id', arenaId)
            .single()

        if (error) throw new Error(error.message)
        return { success: true, data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar estação'
        return { success: false, error: message, data: null }
    }
}

export async function getStationTypesAction(arenaId: string) {
    try {
        await assertArenaBackofficeAccess(arenaId)
        const { data, error } = await getSupabaseAdmin()
            .from('station_types')
            .select('*')
            .order('name')

        if (error) throw new Error(error.message)
        return { success: true, data: data ?? [] }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar tipos de estação'
        return { success: false, error: message, data: [] }
    }
}

/** Estações reais da arena (catálogo / produtos), com tipo para persistir em `products`. */
export async function getArenaStationsForCatalogAction(arenaId: string) {
    try {
        await assertArenaBackofficeAccess(arenaId)
        const { data, error } = await getSupabaseAdmin()
            .from('stations')
            .select(`id, name, station_type_id, station_type:station_types(id, name)`)
            .eq('arena_id', arenaId)
            .not('station_type_id', 'is', null)
            .order('name', { ascending: true })

        if (error) throw new Error(error.message)
        return { success: true, data: data ?? [] }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar estações da arena'
        return { success: false, error: message, data: [] }
    }
}

export async function createStationAction(arenaId: string, input: { name: string; status: string; station_type_id: string }) {
    try {
        await assertArenaAdminAccess(arenaId)
        const { data, error } = await getSupabaseAdmin()
            .from('stations')
            .insert([{ ...input, arena_id: arenaId }])
            .select()
            .single()

        if (error) throw new Error(error.message)
        return { success: true, data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao criar estação'
        return { success: false, error: message, data: null }
    }
}

export async function updateStationAction(arenaId: string, stationId: string, input: Partial<{ name: string; status: string; station_type_id: string }>) {
    try {
        await assertArenaAdminAccess(arenaId)
        await assertStationAccess(stationId, arenaId)
        const { data, error } = await getSupabaseAdmin()
            .from('stations')
            .update(input)
            .eq('id', stationId)
            .eq('arena_id', arenaId)
            .select()
            .single()

        if (error) throw new Error(error.message)
        return { success: true, data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao atualizar estação'
        return { success: false, error: message, data: null }
    }
}
