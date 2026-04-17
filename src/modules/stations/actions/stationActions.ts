"use server"

import { getSupabaseAdmin } from '@/lib/supabase-server'
import { assertArenaAccess, assertArenaBackofficeAccess, assertStationAccess } from '@/lib/server-auth'

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
            supabase
                .from('station_orders')
                .select('station_id, created_at')
                .in('station_id', stationIds)
                .eq('status', 'open'),
            supabase
                .from('station_orders')
                .select('station_id')
                .in('station_id', stationIds)
                .eq('status', 'closed')
                .gte('closed_at', todayISO),
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

export async function getStationWithOrdersAction(arenaId: string, stationId: string) {
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
            supabase
                .from('station_orders')
                .select(`*, atleta:atleta(nome_perfil), station_order_items(*, product:products(name))`)
                .eq('station_id', stationId)
                .eq('arena_id', arenaId)
                .order('created_at', { ascending: false }),
        ])

        if (stationRes.error) throw new Error(stationRes.error.message)

        return { success: true, station: stationRes.data, orders: ordersRes.data ?? [] }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar estação'
        return { success: false, error: message, station: null, orders: [] }
    }
}

export async function getOrdersByStationAction(arenaId: string, stationId: string) {
    try {
        await assertStationAccess(stationId, arenaId)
        const { data, error } = await getSupabaseAdmin()
            .from('station_orders')
            .select(`*, atleta:atleta(nome_perfil), station_order_items(*, product:products(name))`)
            .eq('station_id', stationId)
            .eq('arena_id', arenaId)
            .order('created_at', { ascending: false })

        if (error) throw new Error(error.message)
        return { success: true, data: data ?? [] }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar comandas'
        return { success: false, error: message, data: [] }
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

export async function createStationAction(arenaId: string, input: { name: string; status: string; station_type_id: string }) {
    try {
        await assertArenaBackofficeAccess(arenaId)
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
        await assertArenaBackofficeAccess(arenaId)
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
