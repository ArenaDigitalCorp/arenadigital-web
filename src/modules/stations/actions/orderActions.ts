"use server"

import { getSupabaseAdmin } from '@/lib/supabase-server'
import { assertArenaAccess, assertStationAccess, assertStationOrderAccess, requireAuthenticatedDbUser } from '@/lib/server-auth'
import { SupabaseFinanceRepository } from '@/modules/finance/repositories/SupabaseFinanceRepository'
import type { Database } from '@/types/supabase.types'

type StationOrderInsert = Database['public']['Tables']['station_orders']['Insert']
type StationOrderUpdate = Database['public']['Tables']['station_orders']['Update']
type StationOrderPaymentInsert = Database['public']['Tables']['station_payments']['Insert']
type OrderItemInput = { product_id: string; quantity: number; unit_price: number; total_price: number }

async function ensureAthleteBelongsToArena(arenaId: string, athleteId: string) {
    const { data, error } = await getSupabaseAdmin()
        .from('arenas_atleta')
        .select('id_atleta')
        .eq('id_arena', arenaId)
        .eq('id_atleta', athleteId)
        .maybeSingle()

    if (error) throw new Error(`Erro ao validar atleta da comanda: ${error.message}`)
    if (!data) throw new Error('Atleta não pertence à arena informada')
}

async function ensureCustomerBelongsToArena(arenaId: string, customerId: string) {
    const { data, error } = await getSupabaseAdmin()
        .from('station_customers')
        .select('id')
        .eq('id', customerId)
        .eq('arena_id', arenaId)
        .maybeSingle()

    if (error) throw new Error(`Erro ao validar cliente da comanda: ${error.message}`)
    if (!data) throw new Error('Cliente não pertence à arena informada')
}

async function getValidatedProductStocks(arenaId: string, items: OrderItemInput[]) {
    const uniqueProductIds = [...new Set(items.map(item => item.product_id))]
    const requestedQuantities = new Map<string, number>()

    for (const item of items) {
        requestedQuantities.set(item.product_id, (requestedQuantities.get(item.product_id) ?? 0) + item.quantity)
    }

    if (uniqueProductIds.length === 0) {
        return new Map<string, { currentStock: number }>()
    }

    const { data, error } = await getSupabaseAdmin()
        .from('products')
        .select('id, arena_id, stock_quantity')
        .in('id', uniqueProductIds)

    if (error) throw new Error(`Erro ao validar produtos da comanda: ${error.message}`)
    if (!data || data.length !== uniqueProductIds.length) {
        throw new Error('Um ou mais produtos informados não foram encontrados')
    }

    const productStocks = new Map<string, { currentStock: number }>()
    for (const product of data) {
        if (product.arena_id !== arenaId) {
            throw new Error('Um ou mais produtos não pertencem à arena informada')
        }

        const currentStock = product.stock_quantity || 0
        const requestedQuantity = requestedQuantities.get(product.id) ?? 0
        if (currentStock < requestedQuantity) {
            throw new Error(`Estoque insuficiente para o produto selecionado. Disponível: ${currentStock}, solicitado: ${requestedQuantity}`)
        }

        productStocks.set(product.id, { currentStock })
    }

    return productStocks
}

async function rollbackStockUpdates(
    appliedUpdates: Array<{ productId: string; previousStock: number; movementId: string }>
) {
    if (appliedUpdates.length === 0) return

    const supabase = getSupabaseAdmin()
    for (const update of [...appliedUpdates].reverse()) {
        await supabase.from('product_stock_movements').delete().eq('id', update.movementId)
        await supabase.from('products').update({ stock_quantity: update.previousStock }).eq('id', update.productId)
    }
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
        const { data, error } = await getSupabaseAdmin()
            .from('station_orders')
            .update(input)
            .eq('id', orderId)
            .eq('arena_id', arenaId)
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
    items: OrderItemInput[]
) {
    let createdOrderId: string | null = null
    const appliedStockUpdates: Array<{ productId: string; previousStock: number; movementId: string }> = []

    try {
        await assertArenaAccess(arenaId)
        await assertStationAccess(orderInput.station_id, arenaId)
        if (orderInput.atleta_id) await ensureAthleteBelongsToArena(arenaId, orderInput.atleta_id)
        if (orderInput.customer_id) await ensureCustomerBelongsToArena(arenaId, orderInput.customer_id)

        const { dbUserId } = await requireAuthenticatedDbUser()
        const supabase = getSupabaseAdmin()
        const productStocks = await getValidatedProductStocks(arenaId, items)
        const totalValue = items.reduce((acc, item) => acc + item.total_price, 0)

        const { data: order, error: orderError } = await supabase
            .from('station_orders')
            .insert([{ ...orderInput, arena_id: arenaId, total_value: totalValue }])
            .select()
            .single()

        if (orderError) throw new Error(orderError.message)
        createdOrderId = order.id

        let createdItems: Array<{ id: string }> = []
        if (items.length > 0) {
            const { data: insertedItems, error: itemsError } = await supabase
                .from('station_order_items')
                .insert(items.map(item => ({ ...item, order_id: order.id })))
                .select()

            if (itemsError) throw new Error(itemsError.message)
            createdItems = insertedItems ?? []

            for (let index = 0; index < createdItems.length; index += 1) {
                const createdItem = createdItems[index]
                const sourceItem = items[index]
                const stockState = productStocks.get(sourceItem.product_id)
                if (!stockState) throw new Error('Produto não encontrado durante a atualização de estoque')

                const nextStock = stockState.currentStock - sourceItem.quantity
                const { data: movement, error: movementError } = await supabase
                    .from('product_stock_movements')
                    .insert([{
                        product_id: sourceItem.product_id,
                        arena_id: arenaId,
                        type: 'saida',
                        quantity: sourceItem.quantity,
                        reference_type: 'order_item',
                        reference_id: createdItem.id,
                        balance_after: nextStock,
                        registered_by: dbUserId,
                    }])
                    .select('id')
                    .single()

                if (movementError) throw new Error(movementError.message)

                const { error: updateProductError } = await supabase
                    .from('products')
                    .update({ stock_quantity: nextStock })
                    .eq('id', sourceItem.product_id)

                if (updateProductError) {
                    await supabase.from('product_stock_movements').delete().eq('id', movement.id)
                    throw new Error(updateProductError.message)
                }

                appliedStockUpdates.push({
                    productId: sourceItem.product_id,
                    previousStock: stockState.currentStock,
                    movementId: movement.id,
                })
                stockState.currentStock = nextStock
            }
        }

        return { success: true, data: { order, items: createdItems } }
    } catch (err) {
        await rollbackStockUpdates(appliedStockUpdates)
        if (createdOrderId) {
            await getSupabaseAdmin().from('station_orders').delete().eq('id', createdOrderId)
        }
        const message = err instanceof Error ? err.message : 'Erro ao abrir comanda'
        return { success: false, error: message, data: null }
    }
}

export async function addOrderItemsAction(
    arenaId: string,
    orderId: string,
    items: OrderItemInput[]
) {
    const appliedStockUpdates: Array<{ productId: string; previousStock: number; movementId: string }> = []
    let insertedItemIds: string[] = []

    try {
        await assertStationOrderAccess(orderId, arenaId)
        if (items.length === 0) return { success: true, data: [] }

        const { dbUserId } = await requireAuthenticatedDbUser()
        const supabase = getSupabaseAdmin()
        const productStocks = await getValidatedProductStocks(arenaId, items)
        const launchTotalValue = items.reduce((acc, item) => acc + item.total_price, 0)

        const { data: order, error: orderError } = await supabase
            .from('station_orders')
            .select('total_value')
            .eq('id', orderId)
            .eq('arena_id', arenaId)
            .single()

        if (orderError) throw new Error(orderError.message)

        const { data, error } = await supabase
            .from('station_order_items')
            .insert(items.map(item => ({ ...item, order_id: orderId })))
            .select()

        if (error) throw new Error(error.message)
        insertedItemIds = (data ?? []).map(item => item.id)

        for (let index = 0; index < (data ?? []).length; index += 1) {
            const createdItem = data![index]
            const sourceItem = items[index]
            const stockState = productStocks.get(sourceItem.product_id)
            if (!stockState) throw new Error('Produto não encontrado durante a atualização de estoque')

            const nextStock = stockState.currentStock - sourceItem.quantity
            const { data: movement, error: movementError } = await supabase
                .from('product_stock_movements')
                .insert([{
                    product_id: sourceItem.product_id,
                    arena_id: arenaId,
                    type: 'saida',
                    quantity: sourceItem.quantity,
                    reference_type: 'order_item',
                    reference_id: createdItem.id,
                    balance_after: nextStock,
                    registered_by: dbUserId,
                }])
                .select('id')
                .single()

            if (movementError) throw new Error(movementError.message)

            const { error: updateProductError } = await supabase
                .from('products')
                .update({ stock_quantity: nextStock })
                .eq('id', sourceItem.product_id)

            if (updateProductError) {
                await supabase.from('product_stock_movements').delete().eq('id', movement.id)
                throw new Error(updateProductError.message)
            }

            appliedStockUpdates.push({
                productId: sourceItem.product_id,
                previousStock: stockState.currentStock,
                movementId: movement.id,
            })
            stockState.currentStock = nextStock
        }

        const { error: updateOrderError } = await supabase
            .from('station_orders')
            .update({ total_value: (order.total_value ?? 0) + launchTotalValue })
            .eq('id', orderId)
            .eq('arena_id', arenaId)

        if (updateOrderError) throw new Error(updateOrderError.message)

        return { success: true, data: data ?? [] }
    } catch (err) {
        await rollbackStockUpdates(appliedStockUpdates)
        if (insertedItemIds.length > 0) {
            await getSupabaseAdmin().from('station_order_items').delete().in('id', insertedItemIds)
        }
        const message = err instanceof Error ? err.message : 'Erro ao lançar itens'
        return { success: false, error: message, data: [] }
    }
}

export async function addPaymentAction(arenaId: string, input: Omit<StationOrderPaymentInsert, 'arena_id'>) {
    try {
        await assertStationOrderAccess(input.order_id, arenaId)
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
    const createdFinanceIds: string[] = []
    let shouldRollbackOrder = false

    try {
        await assertStationOrderAccess(orderId, arenaId)
        const { dbUserId } = await requireAuthenticatedDbUser()
        const supabase = getSupabaseAdmin()
        const now = new Date().toISOString()

        const { error: orderError } = await supabase
            .from('station_orders')
            .update({ status: 'closed', closed_at: now })
            .eq('id', orderId)
            .eq('arena_id', arenaId)

        if (orderError) throw new Error(orderError.message)
        shouldRollbackOrder = true

        const { data: order, error: fetchError } = await supabase
            .from('station_orders')
            .select(ORDER_WITH_RELATIONS)
            .eq('id', orderId)
            .eq('arena_id', arenaId)
            .single()

        if (fetchError) throw new Error(fetchError.message)
        if (!order?.station_payments || order.station_payments.length === 0) {
            return { success: true, data: order }
        }

        const [{ data: dbPaymentMethods }, { data: stationData }] = await Promise.all([
            supabase.from('modo_pagamento').select('id, nome'),
            supabase.from('stations').select('*, station_type:station_types(name)').eq('id', order.station_id).single(),
        ])

        const stationTypeName = (
            stationData as { station_type?: { name?: string | null } | null } | null
        )?.station_type?.name ?? 'Bar'
        const financeRepo = new SupabaseFinanceRepository(supabase)
        const orderPayments = order.station_payments as Array<{
            amount: number
            observation: string | null
            paid_by_name: string | null
            payment_method: string
        }>
        const orderMetadata = order as { atleta_id: string | null; order_number: number | string }

        for (const payment of orderPayments) {
            const matchedMethod = dbPaymentMethods?.find(
                pm => pm.nome.toLowerCase() === payment.payment_method.toLowerCase()
            )

            let description = `${stationTypeName} - Comanda #${String(orderMetadata.order_number).padStart(3, '0')}`
            if (payment.observation) description += ` - ${payment.observation}`
            if (payment.paid_by_name) description += ` (Pago por: ${payment.paid_by_name})`

            const transaction = await financeRepo.create({
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
                atleta_id: orderMetadata.atleta_id || null,
                modo_pagamento_id: matchedMethod?.id || null,
            })
            createdFinanceIds.push(transaction.id)
        }

        return { success: true, data: order }
    } catch (err) {
        const supabase = getSupabaseAdmin()
        if (createdFinanceIds.length > 0) {
            await supabase.from('transactions').delete().in('id', createdFinanceIds)
        }
        if (shouldRollbackOrder) {
            await supabase
                .from('station_orders')
                .update({ status: 'open', closed_at: null })
                .eq('id', orderId)
                .eq('arena_id', arenaId)
        }
        const message = err instanceof Error ? err.message : 'Erro ao fechar comanda'
        return { success: false, error: message, data: null }
    }
}
