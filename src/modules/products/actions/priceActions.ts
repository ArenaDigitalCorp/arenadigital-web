"use server"

import { getSupabaseAdmin } from '@/lib/supabase-server'
import { requireAuthenticatedDbUser, assertArenaAdminAccess, assertProductAccess } from '@/lib/server-auth'
import {
    type PriceAdjustmentType,
    type PriceHistoryEntry,
    type PriceRoundingMode,
} from '@/modules/products/types/product.types'
import { revalidatePath } from 'next/cache'

export async function getPriceHistoryByProductAction(productId: string) {
    try {
        const arenaId = await assertProductAccess(productId)
        const { data, error } = await getSupabaseAdmin()
            .from('product_price_history')
            .select('*, user:users!product_price_history_changed_by_fkey(name)')
            .eq('product_id', productId)
            .eq('arena_id', arenaId)
            .order('created_at', { ascending: false })

        if (error) throw new Error(error.message)
        return { success: true, data: (data ?? []) as PriceHistoryEntry[] }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar histórico de preços'
        return { success: false, error: message, data: [] as PriceHistoryEntry[] }
    }
}

export interface BulkAdjustInput {
    batch_id: string
    category_id: string
    adjustment_type: PriceAdjustmentType
    amount: number
    rounding: PriceRoundingMode
    include_inactive: boolean
    reason?: string
}

export async function bulkAdjustPricesAction(arenaId: string, input: BulkAdjustInput) {
    try {
        await assertArenaAdminAccess(arenaId)
        const { dbUserId } = await requireAuthenticatedDbUser()

        if (!Number.isFinite(input.amount) || input.amount === 0) {
            throw new Error('Informe um valor de reajuste diferente de zero')
        }
        if (input.adjustment_type === 'percent' && input.amount <= -100) {
            throw new Error('Reajuste percentual deve ser maior que -100%')
        }

        const batchId = input.batch_id
        const rpc = getSupabaseAdmin() as unknown as {
            rpc: (
                name: 'bulk_adjust_product_prices',
                args: Record<string, unknown>
            ) => Promise<{
                data: { batchId: string; adjustedCount: number } | null
                error: { message: string } | null
            }>
        }
        const { data, error } = await rpc.rpc('bulk_adjust_product_prices', {
            p_arena_id: arenaId,
            p_category_id: input.category_id,
            p_adjustment_type: input.adjustment_type,
            p_amount: input.amount,
            p_rounding: input.rounding,
            p_include_inactive: input.include_inactive,
            p_reason: input.reason?.trim() || null,
            p_changed_by: dbUserId,
            p_batch_id: batchId,
        })

        if (error) throw new Error(error.message)

        revalidatePath(`/dashboard/settings/products/${arenaId}`)
        return { success: true, data: data ?? { batchId, adjustedCount: 0 } }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao aplicar reajuste de preços'
        return { success: false, error: message, data: null }
    }
}
