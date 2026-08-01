"use server"

import { getSupabaseAdmin } from '@/lib/supabase-server'
import { requireAuthenticatedDbUser, assertArenaAccess, assertArenaAdminAccess } from '@/lib/server-auth'
import type {
    ProductCategory,
    ProductCategoryKind,
    UpdateProductCategoryDTO,
} from '@/modules/products/types/product.types'
import { revalidatePath } from 'next/cache'

export async function getCategoriesByArenaAction(arenaId: string) {
    try {
        await assertArenaAccess(arenaId)
        const { data, error } = await getSupabaseAdmin()
            .from('product_categories')
            .select('*')
            .eq('arena_id', arenaId)
            .order('kind', { ascending: true })
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true })

        if (error) throw new Error(error.message)
        return { success: true, data: (data ?? []) as ProductCategory[] }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar categorias'
        return { success: false, error: message, data: [] as ProductCategory[] }
    }
}

export async function createCategoryAction(
    arenaId: string,
    input: { name: string; kind: ProductCategoryKind }
) {
    try {
        await assertArenaAdminAccess(arenaId)
        const { dbUserId } = await requireAuthenticatedDbUser()
        const name = input.name.trim()
        if (name.length < 2) throw new Error('Nome da categoria deve ter pelo menos 2 caracteres')

        const { data, error } = await getSupabaseAdmin()
            .from('product_categories')
            .insert([{ arena_id: arenaId, name, kind: input.kind, created_by: dbUserId }])
            .select()
            .single()

        if (error) {
            if (error.code === '23505') throw new Error('Já existe uma categoria com este nome')
            throw new Error(error.message)
        }
        revalidatePath(`/dashboard/settings/products/${arenaId}`)
        return { success: true, data: data as ProductCategory }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao criar categoria'
        return { success: false, error: message, data: null }
    }
}

export async function updateCategoryAction(
    arenaId: string,
    categoryId: string,
    input: { name?: string; active?: boolean; sort_order?: number }
) {
    try {
        await assertArenaAdminAccess(arenaId)
        const patch: UpdateProductCategoryDTO = { updated_at: new Date().toISOString() }
        if (input.name !== undefined) {
            const name = input.name.trim()
            if (name.length < 2) throw new Error('Nome da categoria deve ter pelo menos 2 caracteres')
            patch.name = name
        }
        if (input.active !== undefined) patch.active = input.active
        if (input.sort_order !== undefined) patch.sort_order = input.sort_order

        const supabase = getSupabaseAdmin()
        const { data, error } = await supabase
            .from('product_categories')
            .update(patch)
            .eq('id', categoryId)
            .eq('arena_id', arenaId)
            .select()
            .single()

        if (error) {
            if (error.code === '23505') throw new Error('Já existe uma categoria com este nome')
            throw new Error(error.message)
        }

        // Mantém item_type dos produtos alinhado ao nome da categoria (compat comandas/busca)
        if (input.name !== undefined) {
            const { error: syncError } = await supabase
                .from('products')
                .update({ item_type: patch.name as string })
                .eq('arena_id', arenaId)
                .eq('category_id', categoryId)
            if (syncError) throw new Error(syncError.message)
        }

        revalidatePath(`/dashboard/settings/products/${arenaId}`)
        return { success: true, data: data as ProductCategory }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao atualizar categoria'
        return { success: false, error: message, data: null }
    }
}

export async function deleteCategoryAction(arenaId: string, categoryId: string) {
    try {
        await assertArenaAdminAccess(arenaId)
        const supabase = getSupabaseAdmin()

        const { count, error: countError } = await supabase
            .from('products')
            .select('id', { count: 'exact', head: true })
            .eq('arena_id', arenaId)
            .eq('category_id', categoryId)

        if (countError) throw new Error(countError.message)
        if ((count ?? 0) > 0) {
            throw new Error(
                `Não é possível excluir: há ${count} ite${count === 1 ? 'm' : 'ns'} vinculado${count === 1 ? '' : 's'} a esta categoria. Mova os itens para outra categoria ou inative-a.`
            )
        }

        const { error } = await supabase
            .from('product_categories')
            .delete()
            .eq('id', categoryId)
            .eq('arena_id', arenaId)

        if (error) throw new Error(error.message)
        revalidatePath(`/dashboard/settings/products/${arenaId}`)
        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao excluir categoria'
        return { success: false, error: message }
    }
}
