"use server"

import { getSupabaseAdmin } from '@/lib/supabase-server'
import { assertArenaAccess, requireAuthenticatedDbUser } from '@/lib/server-auth'
import { SupabaseFinanceRepository } from '@/modules/finance/repositories/SupabaseFinanceRepository'
import type { Database } from '@/types/supabase.types'

type StationOrderInsert = Database['public']['Tables']['station_orders']['Insert']
type StationOrderUpdate = Database['public']['Tables']['station_orders']['Update']
type StationOrderPaymentInsert = Database['public']['Tables']['station_payments']['Insert']

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
        return { success: false, error: message, data: [] as any[] }
    }
}

const ORDER_WITH_RELATIONS = `
    *,
    atleta:atleta(nome_perfil),
    station_customer:station_customers(name),
    station_order_items(*, product:products(name)),
    station_payments(*)
` as const

export async function getOrderByIdAction(arenaId: string, orderId: string) {
    try {
        await assertArenaAccess(arenaId)
        const { data, error } = await getSupabaseAdmin()
            .from('station_orders')
            .select(ORDER_WITH_RELATIONS)
            .eq('id', orderId)
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
        await assertArenaAccess(arenaId)
        const { data, error } = await getSupabaseAdmin()
            .from('station_orders')
            .update(input)
            .eq('id', orderId)
            .select()
            .single()

        if (error) throw new Error(error.message)
        return { success: true, data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao atualizar comanda'
        return { success: false, error: message, data: null }
    }
}

export async function createOrderWithItemsAction(
    arenaId: string,
    orderInput: Omit<StationOrderInsert, 'arena_id'>,
    items: { product_id: string; quantity: number; unit_price: number; total_price: number }[]
) {
    try {
        await assertArenaAccess(arenaId)
        const supabase = getSupabaseAdmin()

        const { data: order, error: orderError } = await supabase
            .from('station_orders')
            .insert([{ ...orderInput, arena_id: arenaId }])
            .select()
            .single()

        if (orderError) throw new Error(orderError.message)

        let createdItems: any[] = []
        if (items.length > 0) {
            const { data: insertedItems, error: itemsError } = await supabase
                .from('station_order_items')
                .insert(items.map(item => ({ ...item, order_id: order.id })))
                .select()

            if (itemsError) throw new Error(itemsError.message)
            createdItems = insertedItems ?? []
        }

        return { success: true, data: { order, items: createdItems } }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao abrir comanda'
        return { success: false, error: message, data: null }
    }
}

export async function addOrderItemsAction(
    arenaId: string,
    orderId: string,
    items: { product_id: string; quantity: number; unit_price: number; total_price: number }[]
) {
    try {
        await assertArenaAccess(arenaId)
        if (items.length === 0) return { success: true, data: [] }

        const { data, error } = await getSupabaseAdmin()
            .from('station_order_items')
            .insert(items.map(item => ({ ...item, order_id: orderId })))
            .select()

        if (error) throw new Error(error.message)
        return { success: true, data: data ?? [] }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao lançar itens'
        return { success: false, error: message, data: [] }
    }
}

export async function addPaymentAction(arenaId: string, input: Omit<StationOrderPaymentInsert, 'arena_id'>) {
    try {
        await assertArenaAccess(arenaId)
        const { data, error } = await getSupabaseAdmin()
            .from('station_payments')
            .insert([input])
            .select()
            .single()

        if (error) throw new Error(error.message)
        return { success: true, data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao registrar pagamento'
        return { success: false, error: message, data: null }
    }
}

export async function closeOrderAndGenerateFinanceAction(arenaId: string, orderId: string) {
    try {
        await assertArenaAccess(arenaId)
        const { dbUserId } = await requireAuthenticatedDbUser()
        const supabase = getSupabaseAdmin()
        const now = new Date().toISOString()

        const { error: orderError } = await supabase
            .from('station_orders')
            .update({ status: 'closed', closed_at: now })
            .eq('id', orderId)

        if (orderError) throw new Error(orderError.message)

        const { data: order, error: fetchError } = await supabase
            .from('station_orders')
            .select(ORDER_WITH_RELATIONS)
            .eq('id', orderId)
            .single()

        if (fetchError) throw new Error(fetchError.message)
        if (!order?.station_payments || order.station_payments.length === 0) {
            return { success: true, data: order }
        }

        const [{ data: dbPaymentMethods }, { data: stationData }] = await Promise.all([
            supabase.from('modo_pagamento').select('id, nome'),
            supabase.from('stations').select('*, station_type:station_types(name)').eq('id', order.station_id).single(),
        ])

        const stationTypeName = (stationData as any)?.station_type?.name ?? 'Bar'
        const financeRepo = new SupabaseFinanceRepository(supabase)

        for (const payment of order.station_payments as any[]) {
            const matchedMethod = dbPaymentMethods?.find(
                pm => pm.nome.toLowerCase() === payment.payment_method.toLowerCase()
            )

            let description = `${stationTypeName} - Comanda #${(order as any).order_number.toString().padStart(3, '0')}`
            if (payment.observation) description += ` - ${payment.observation}`
            if (payment.paid_by_name) description += ` (Pago por: ${payment.paid_by_name})`

            await financeRepo.create({
                arena_id: order.arena_id,
                type: 'entrada',
                category: stationTypeName,
                description,
                quantity: 1,
                unit_value: payment.amount,
                discount: 0,
                total_value: payment.amount,
                registration_date: now,
                launch_date: now,
                registered_by: dbUserId,
                atleta_id: (order as any).atleta_id || null,
                modo_pagamento_id: matchedMethod?.id || null,
            })
        }

        return { success: true, data: order }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao fechar comanda'
        return { success: false, error: message, data: null }
    }
}
