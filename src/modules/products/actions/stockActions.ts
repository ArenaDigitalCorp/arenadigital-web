"use server"

import { getSupabaseAdmin } from '@/lib/supabase-server'
import { requireAuthenticatedDbUser, assertArenaAccess } from '@/lib/server-auth'
import { SupabaseProductRepository } from '@/modules/products/repositories/SupabaseProductRepository'

export async function getProductsByArenaAction(arenaId: string) {
    try {
        await assertArenaAccess(arenaId)
        const repo = new SupabaseProductRepository(getSupabaseAdmin())
        const data = await repo.findByArena(arenaId)
        return { success: true, data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar produtos'
        return { success: false, error: message, data: [] as any[] }
    }
}

export async function getStockMovementsByProductAction(productId: string) {
    try {
        const { data, error } = await getSupabaseAdmin()
            .from('product_stock_movements')
            .select(`*, user:users!product_stock_movements_registered_by_fkey(name)`)
            .eq('product_id', productId)
            .order('created_at', { ascending: false })

        if (error) throw new Error(error.message)
        return { success: true, data: data ?? [] }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar movimentações'
        return { success: false, error: message, data: [] }
    }
}

export async function createStockEntryAction(input: {
    product_id: string
    arena_id: string
    quantity: number
    entry_date: string
    supplier: string
    description?: string
    invoice_number?: string
}) {
    try {
        const { dbUserId } = await requireAuthenticatedDbUser()
        const supabase = getSupabaseAdmin()

        const { data: entry, error: entryError } = await supabase
            .from('product_stock_entries')
            .insert([{ ...input, registered_by: dbUserId }])
            .select()
            .single()

        if (entryError) throw new Error(entryError.message)

        const { data: product, error: productError } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', input.product_id)
            .single()

        if (productError) throw new Error(productError.message)

        const newBalance = (product.stock_quantity || 0) + input.quantity

        await supabase.from('product_stock_movements').insert([{
            product_id: input.product_id,
            arena_id: input.arena_id,
            type: 'entrada',
            quantity: input.quantity,
            reference_type: 'stock_entry',
            reference_id: entry.id,
            balance_after: newBalance,
            registered_by: dbUserId,
        }])

        await supabase.from('products').update({ stock_quantity: newBalance }).eq('id', input.product_id)

        return { success: true, data: entry }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao registrar entrada de estoque'
        return { success: false, error: message }
    }
}

export async function registerStockOutflowAction(
    productId: string,
    quantity: number,
    arenaId: string,
    _userId?: string,
    referenceId?: string,
    referenceType = 'order_item'
) {
    try {
        const { dbUserId } = await requireAuthenticatedDbUser()
        const supabase = getSupabaseAdmin()

        const { data: product, error: productError } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', productId)
            .single()

        if (productError) throw new Error(productError.message)

        const currentStock = product.stock_quantity || 0
        if (currentStock < quantity) {
            throw new Error(`Estoque insuficiente. Disponível: ${currentStock}, Solicitado: ${quantity}`)
        }

        const newBalance = currentStock - quantity

        await supabase.from('product_stock_movements').insert([{
            product_id: productId,
            arena_id: arenaId,
            type: 'saida',
            quantity,
            reference_type: referenceType,
            reference_id: referenceId || null,
            balance_after: newBalance,
            registered_by: dbUserId,
        }])

        await supabase.from('products').update({ stock_quantity: newBalance }).eq('id', productId)

        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao registrar saída de estoque'
        return { success: false, error: message }
    }
}

export async function restoreStockForOrderAction(orderId: string, arenaId: string, _userId?: string) {
    try {
        const { dbUserId } = await requireAuthenticatedDbUser()
        const supabase = getSupabaseAdmin()

        const { data: items, error: itemsError } = await supabase
            .from('station_order_items')
            .select('id, product_id, quantity')
            .eq('order_id', orderId)

        if (itemsError) throw new Error(itemsError.message)
        if (!items || items.length === 0) return { success: true }

        for (const item of items) {
            const { data: product } = await supabase
                .from('products')
                .select('stock_quantity')
                .eq('id', item.product_id)
                .single()

            const newBalance = (product?.stock_quantity || 0) + item.quantity

            await supabase.from('product_stock_movements').insert([{
                product_id: item.product_id,
                arena_id: arenaId,
                type: 'entrada',
                quantity: item.quantity,
                reference_type: 'cancellation',
                reference_id: item.id,
                balance_after: newBalance,
                registered_by: dbUserId,
            }])

            await supabase.from('products').update({ stock_quantity: newBalance }).eq('id', item.product_id)
        }

        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao restaurar estoque'
        return { success: false, error: message }
    }
}
