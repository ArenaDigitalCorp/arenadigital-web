"use server"

import { getSupabaseAdmin } from '@/lib/supabase-server'
import { assertArenaAccess, assertStationAccess, assertStationOrderAccess, requireAuthenticatedDbUser } from '@/lib/server-auth'
import type { Database } from '@/types/supabase.types'

type StationOrderInsert = Database['public']['Tables']['station_orders']['Insert']
type StationOrderUpdate = Database['public']['Tables']['station_orders']['Update']
type StationOrderPaymentInsert = Database['public']['Tables']['station_payments']['Insert']
type OrderItemInput = { product_id: string; quantity: number; unit_price: number; total_price: number }

type StationOrderRpcClient = {
    rpc: (
        name:
            | 'append_station_order_items'
            | 'create_station_order_with_items'
            | 'add_station_order_payment'
            | 'close_station_order'
            | 'cancel_station_order',
        args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>
}

function stationOrderRpc() {
    return getSupabaseAdmin() as unknown as StationOrderRpcClient
}

export async function createCustomerAction(arenaId: string, input: { name: string; cpf?: string; phone?: string; email?: string }) {
    try {
        await assertArenaAccess(arenaId)
        const { data, error } = await getSupabaseAdmin()
            .from('station_customers')
            .insert([{ ...input, arena_id: arenaId }])
            .select()
            .single()
        if (error) throw new Error(error.message)
        return { success: true, data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao criar cliente'
        return { success: false, error: message, data: null }
    }
}

export async function getCustomersByArenaAction(arenaId: string) {
    try {
        await assertArenaAccess(arenaId)
        const { data, error } = await getSupabaseAdmin()
            .from('station_customers')
            .select('*')
            .eq('arena_id', arenaId)
            .order('name', { ascending: true })
        if (error) throw new Error(error.message)
        return { success: true, data: data ?? [] }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar clientes'
        return { success: false, error: message, data: [] }
    }
}

const ORDER_WITH_RELATIONS = `
    *,
    atleta:atleta(nome_perfil),
    station_customer:station_customers(name),
    station:stations(station_type_id),
    station_order_items(*, product:products(name)),
    station_payments(*)
` as const

export async function getOrderByIdAction(arenaId: string, orderId: string) {
    try {
        await assertStationOrderAccess(orderId, arenaId)
        const { data, error } = await getSupabaseAdmin()
            .from('station_orders')
            .select(ORDER_WITH_RELATIONS)
            .eq('id', orderId)
            .eq('arena_id', arenaId)
            .single()

        if (error) throw new Error(error.message)
        return { success: true, data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar comanda'
        return { success: false, error: message, data: null }
    }
}

export async function updateOrderAction(arenaId: string, orderId: string, input: StationOrderUpdate) {
    try {
        await assertStationOrderAccess(orderId, arenaId)
        if (input.status !== 'cancelled' || Object.keys(input).some(key => key !== 'status')) {
            throw new Error('Esta operação de atualização de comanda não é permitida')
        }
        const { dbUserId } = await requireAuthenticatedDbUser()
        const { data, error } = await stationOrderRpc().rpc('cancel_station_order', {
            p_arena_id: arenaId,
            p_order_id: orderId,
            p_registered_by: dbUserId,
        })

        if (error) throw new Error(error.message)
        return { success: true, data: Array.isArray(data) ? data[0] : data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao atualizar comanda'
        return { success: false, error: message, data: null }
    }
}

export async function createOrderWithItemsAction(
    arenaId: string,
    orderInput: Omit<StationOrderInsert, 'arena_id'>,
    items: OrderItemInput[]
) {
    try {
        await assertArenaAccess(arenaId)
        await assertStationAccess(orderInput.station_id, arenaId)
        const { dbUserId } = await requireAuthenticatedDbUser()
        const { data, error } = await stationOrderRpc().rpc('create_station_order_with_items', {
            p_arena_id: arenaId,
            p_station_id: orderInput.station_id,
            p_atleta_id: orderInput.atleta_id ?? null,
            p_customer_id: orderInput.customer_id ?? null,
            p_customer_name: orderInput.customer_name ?? null,
            p_items: items,
            p_registered_by: dbUserId,
        })
        if (error) throw new Error(error.message)
        const order = Array.isArray(data) ? data[0] : data
        return { success: true, data: { order, items: [] } }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao abrir comanda'
        return { success: false, error: message, data: null }
    }
}

export async function addOrderItemsAction(
    arenaId: string,
    orderId: string,
    items: OrderItemInput[]
) {
    try {
        await assertStationOrderAccess(orderId, arenaId)
        if (items.length === 0) return { success: true, data: [] }
        const { dbUserId } = await requireAuthenticatedDbUser()
        const { data, error } = await stationOrderRpc().rpc('append_station_order_items', {
            p_arena_id: arenaId,
            p_order_id: orderId,
            p_items: items,
            p_registered_by: dbUserId,
        })
        if (error) throw new Error(error.message)
        return { success: true, data: Array.isArray(data) ? data : data ? [data] : [] }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao lançar itens'
        return { success: false, error: message, data: [] }
    }
}

export async function addPaymentAction(
    arenaId: string,
    input: Omit<StationOrderPaymentInsert, 'arena_id'> & { idempotency_key?: string }
) {
    try {
        await assertStationOrderAccess(input.order_id, arenaId)
        const { dbUserId } = await requireAuthenticatedDbUser()
        const { data, error } = await stationOrderRpc().rpc('add_station_order_payment', {
            p_arena_id: arenaId,
            p_order_id: input.order_id,
            p_amount: input.amount,
            p_payment_method: input.payment_method,
            p_paid_by_name: input.paid_by_name ?? null,
            p_observation: input.observation ?? null,
            p_registered_by: dbUserId,
            p_idempotency_key: input.idempotency_key ?? null,
        })
        if (error) throw new Error(error.message)
        return { success: true, data: Array.isArray(data) ? data[0] : data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao registrar pagamento'
        return { success: false, error: message, data: null }
    }
}

export async function closeOrderAndGenerateFinanceAction(arenaId: string, orderId: string) {
    try {
        await assertStationOrderAccess(orderId, arenaId)
        const { dbUserId } = await requireAuthenticatedDbUser()
        const { data, error } = await stationOrderRpc().rpc('close_station_order', {
            p_arena_id: arenaId,
            p_order_id: orderId,
            p_registered_by: dbUserId,
        })
        if (error) throw new Error(error.message)
        return { success: true, data: Array.isArray(data) ? data[0] : data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao fechar comanda'
        return { success: false, error: message, data: null }
    }
}
