"use server"

import { getSupabaseAdmin } from '@/lib/supabase-server'
import { requireAuthenticatedDbUser, assertArenaAccess, assertArenaBackofficeAccess, assertProductAccess, assertStationOrderAccess } from '@/lib/server-auth'
import { SupabaseProductRepository } from '@/modules/products/repositories/SupabaseProductRepository'
import type { CreateProductDTO, UpdateProductDTO } from '@/modules/products/types/product.types'
import { revalidatePath } from 'next/cache'

async function getProductStockSnapshot(productId: string, arenaId?: string) {
    const resolvedArenaId = await assertProductAccess(productId, arenaId)
    const { data, error } = await getSupabaseAdmin()
        .from('products')
        .select('id, arena_id, stock_quantity')
        .eq('id', productId)
        .single()

    if (error) throw new Error(error.message)

    return {
        arenaId: resolvedArenaId,
        stockQuantity: data.stock_quantity || 0,
    }
}

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

export async function createProductAction(arenaId: string, input: CreateProductDTO) {
    try {
        await assertArenaBackofficeAccess(arenaId)
        if (input.arena_id !== arenaId) {
            throw new Error('Produto não pertence à arena informada')
        }
        const repo = new SupabaseProductRepository(getSupabaseAdmin())
        const data = await repo.create(input)
        revalidatePath(`/dashboard/settings/products/${arenaId}`)
        return { success: true, data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao criar produto'
        return { success: false, error: message, data: null }
    }
}

export async function updateProductAction(arenaId: string, productId: string, input: UpdateProductDTO) {
    try {
        await assertProductAccess(productId, arenaId)
        if ('arena_id' in input && input.arena_id && input.arena_id !== arenaId) {
            throw new Error('Produto não pertence à arena informada')
        }
        const repo = new SupabaseProductRepository(getSupabaseAdmin())
        const data = await repo.update(productId, input)
        revalidatePath(`/dashboard/settings/products/${arenaId}`)
        return { success: true, data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao atualizar produto'
        return { success: false, error: message, data: null }
    }
}

export async function deleteProductAction(arenaId: string, productId: string) {
    try {
        await assertProductAccess(productId, arenaId)
        const repo = new SupabaseProductRepository(getSupabaseAdmin())
        await repo.delete(productId)
        revalidatePath(`/dashboard/settings/products/${arenaId}`)
        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao excluir produto'
        return { success: false, error: message }
    }
}

export async function getStockMovementsByProductAction(productId: string) {
    try {
        const arenaId = await assertProductAccess(productId)
        const { data, error } = await getSupabaseAdmin()
            .from('product_stock_movements')
            .select(`*, user:users!product_stock_movements_registered_by_fkey(name)`)
            .eq('product_id', productId)
            .eq('arena_id', arenaId)
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
    let entryId: string | null = null
    let movementId: string | null = null

    try {
        await assertArenaBackofficeAccess(input.arena_id)
        const { dbUserId } = await requireAuthenticatedDbUser()
        const supabase = getSupabaseAdmin()
        const product = await getProductStockSnapshot(input.product_id, input.arena_id)
        const newBalance = product.stockQuantity + input.quantity

        const { data: entry, error: entryError } = await supabase
            .from('product_stock_entries')
            .insert([{ ...input, registered_by: dbUserId }])
            .select()
            .single()

        if (entryError) throw new Error(entryError.message)
        entryId = entry.id

        const { data: movement, error: movementError } = await supabase.from('product_stock_movements').insert([{
            product_id: input.product_id,
            arena_id: input.arena_id,
            type: 'entrada',
            quantity: input.quantity,
            reference_type: 'stock_entry',
            reference_id: entry.id,
            balance_after: newBalance,
            registered_by: dbUserId,
        }]).select('id').single()

        if (movementError) throw new Error(movementError.message)
        movementId = movement.id

        const { error: updateError } = await supabase
            .from('products')
            .update({ stock_quantity: newBalance })
            .eq('id', input.product_id)

        if (updateError) throw new Error(updateError.message)

        return { success: true, data: entry }
    } catch (err) {
        const supabase = getSupabaseAdmin()
        const error = err instanceof Error ? err : new Error('Erro ao registrar entrada de estoque')

        if (movementId) {
            await supabase.from('product_stock_movements').delete().eq('id', movementId)
        }
        if (entryId) {
            await supabase.from('product_stock_entries').delete().eq('id', entryId)
        }

        return { success: false, error: error.message }
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
        await assertArenaBackofficeAccess(arenaId)
        const { dbUserId } = await requireAuthenticatedDbUser()
        const supabase = getSupabaseAdmin()
        const product = await getProductStockSnapshot(productId, arenaId)
        const currentStock = product.stockQuantity
        if (currentStock < quantity) {
            throw new Error(`Estoque insuficiente. Disponível: ${currentStock}, Solicitado: ${quantity}`)
        }

        const newBalance = currentStock - quantity
        let movementId: string | null = null

        const { data: movement, error: movementError } = await supabase.from('product_stock_movements').insert([{
            product_id: productId,
            arena_id: arenaId,
            type: 'saida',
            quantity,
            reference_type: referenceType,
            reference_id: referenceId || null,
            balance_after: newBalance,
            registered_by: dbUserId,
        }]).select('id').single()

        if (movementError) throw new Error(movementError.message)
        movementId = movement.id

        const { error: updateError } = await supabase
            .from('products')
            .update({ stock_quantity: newBalance })
            .eq('id', productId)

        if (updateError) {
            await supabase.from('product_stock_movements').delete().eq('id', movementId)
            throw new Error(updateError.message)
        }

        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao registrar saída de estoque'
        return { success: false, error: message }
    }
}

export async function restoreStockForOrderAction(orderId: string, arenaId: string, _userId?: string) {
    const appliedRestores: Array<{ productId: string; previousStock: number; movementId: string }> = []

    try {
        await assertStationOrderAccess(orderId, arenaId)
        const { dbUserId } = await requireAuthenticatedDbUser()
        const supabase = getSupabaseAdmin()

        const { data: items, error: itemsError } = await supabase
            .from('station_order_items')
            .select('id, product_id, quantity')
            .eq('order_id', orderId)

        if (itemsError) throw new Error(itemsError.message)
        if (!items || items.length === 0) return { success: true }

        for (const item of items) {
            const product = await getProductStockSnapshot(item.product_id, arenaId)
            const newBalance = product.stockQuantity + item.quantity

            const { data: movement, error: movementError } = await supabase.from('product_stock_movements').insert([{
                product_id: item.product_id,
                arena_id: arenaId,
                type: 'entrada',
                quantity: item.quantity,
                reference_type: 'cancellation',
                reference_id: item.id,
                balance_after: newBalance,
                registered_by: dbUserId,
            }]).select('id').single()

            if (movementError) throw new Error(movementError.message)

            const { error: updateError } = await supabase
                .from('products')
                .update({ stock_quantity: newBalance })
                .eq('id', item.product_id)

            if (updateError) {
                await supabase.from('product_stock_movements').delete().eq('id', movement.id)
                throw new Error(updateError.message)
            }

            appliedRestores.push({
                productId: item.product_id,
                previousStock: product.stockQuantity,
                movementId: movement.id,
            })
        }

        return { success: true }
    } catch (err) {
        if (appliedRestores.length > 0) {
            const supabase = getSupabaseAdmin()
            for (const restore of [...appliedRestores].reverse()) {
                await supabase.from('product_stock_movements').delete().eq('id', restore.movementId)
                await supabase.from('products').update({ stock_quantity: restore.previousStock }).eq('id', restore.productId)
            }
        }
        const message = err instanceof Error ? err.message : 'Erro ao restaurar estoque'
        return { success: false, error: message }
    }
}
