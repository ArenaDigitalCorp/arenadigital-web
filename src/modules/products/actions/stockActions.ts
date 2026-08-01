"use server"

import { getSupabaseAdmin } from '@/lib/supabase-server'
import { requireAuthenticatedDbUser, assertArenaAccess, assertArenaAdminAccess, assertArenaBackofficeAccess, assertProductAccess, assertStationOrderAccess } from '@/lib/server-auth'
import { SupabaseProductRepository } from '@/modules/products/repositories/SupabaseProductRepository'
import type { CreateProductDTO, Product, UpdateProductDTO } from '@/modules/products/types/product.types'
import { revalidatePath } from 'next/cache'

type StockRpcName =
    | 'register_product_stock_entry'
    | 'register_product_stock_outflow'
    | 'cancel_station_order'

type StockRpcClient = {
    rpc: (
        name: StockRpcName,
        args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message: string } | null }>
}

function stockRpc() {
    return getSupabaseAdmin() as unknown as StockRpcClient
}

type CatalogKind = 'product' | 'service'

async function resolveCatalogReferences(
    arenaId: string,
    categoryId: string,
    catalogKind: CatalogKind,
    stationId: string | null,
    stationTypeId: string | null,
) {
    const supabase = getSupabaseAdmin()
    const { data: category, error: categoryError } = await supabase
        .from('product_categories')
        .select('id, name, kind')
        .eq('id', categoryId)
        .eq('arena_id', arenaId)
        .eq('kind', catalogKind)
        .maybeSingle()

    if (categoryError) throw new Error(categoryError.message)
    if (!category) throw new Error('Categoria não pertence à arena ou ao tipo informado')

    if (catalogKind === 'service') {
        return { category, stationId: null, stationTypeId: null }
    }

    if (stationId) {
        const { data: station, error: stationError } = await supabase
            .from('stations')
            .select('id, station_type_id')
            .eq('id', stationId)
            .eq('arena_id', arenaId)
            .maybeSingle()
        if (stationError) throw new Error(stationError.message)
        if (!station) throw new Error('Estação não pertence à arena')
        return { category, stationId: station.id, stationTypeId: station.station_type_id }
    }

    if (!stationTypeId) throw new Error('Selecione o tipo de estação do produto')
    const { data: stationType, error: stationTypeError } = await supabase
        .from('station_types')
        .select('id')
        .eq('id', stationTypeId)
        .maybeSingle()
    if (stationTypeError) throw new Error(stationTypeError.message)
    if (!stationType) throw new Error('Tipo de estação inválido')

    return { category, stationId: null, stationTypeId: stationType.id }
}

function validateCatalogBasics(name: string, price: number, status: string | null | undefined) {
    const normalizedName = name.trim()
    if (normalizedName.length < 2) throw new Error('Nome deve ter pelo menos 2 caracteres')
    if (!Number.isFinite(price) || price < 0) throw new Error('Preço inválido')
    if (status !== 'Ativo' && status !== 'Inativo') throw new Error('Status inválido')
    return normalizedName
}

export async function getProductsByArenaAction(arenaId: string) {
    try {
        await assertArenaAccess(arenaId)
        const repo = new SupabaseProductRepository(getSupabaseAdmin())
        const data = await repo.findByArena(arenaId)
        return { success: true, data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar produtos'
        return { success: false, error: message, data: [] as Product[] }
    }
}

export async function createProductAction(arenaId: string, input: CreateProductDTO) {
    try {
        await assertArenaAdminAccess(arenaId)
        if (input.arena_id !== arenaId) {
            throw new Error('Produto não pertence à arena informada')
        }
        const { dbUserId } = await requireAuthenticatedDbUser()
        const catalogKind: CatalogKind = input.catalog_kind === 'service' ? 'service' : 'product'
        if (!input.category_id) throw new Error('Selecione uma categoria')
        const name = validateCatalogBasics(input.name, Number(input.price), input.status ?? 'Ativo')
        const refs = await resolveCatalogReferences(
            arenaId,
            input.category_id,
            catalogKind,
            input.station_id ?? null,
            input.station_type_id ?? null,
        )
        const payload: CreateProductDTO = {
            arena_id: arenaId,
            name,
            category_id: refs.category.id,
            item_type: refs.category.name,
            station_id: refs.stationId,
            station_type_id: refs.stationTypeId,
            price: Number(input.price),
            catalog_kind: catalogKind,
            status: input.status ?? 'Ativo',
            stock_quantity: 0,
            created_by: dbUserId,
            updated_by: dbUserId,
        }
        const repo = new SupabaseProductRepository(getSupabaseAdmin())
        const data = await repo.create(payload)
        revalidatePath(`/dashboard/settings/products/${arenaId}`)
        return { success: true, data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao criar produto'
        return { success: false, error: message, data: null }
    }
}

export async function updateProductAction(arenaId: string, productId: string, input: UpdateProductDTO) {
    try {
        await assertArenaAdminAccess(arenaId)
        await assertProductAccess(productId, arenaId)
        if ('arena_id' in input && input.arena_id && input.arena_id !== arenaId) {
            throw new Error('Produto não pertence à arena informada')
        }
        const { dbUserId } = await requireAuthenticatedDbUser()
        const supabase = getSupabaseAdmin()
        const { data: current, error: currentError } = await supabase
            .from('products')
            .select('name, category_id, station_id, station_type_id, price, status, catalog_kind, stock_quantity')
            .eq('id', productId)
            .eq('arena_id', arenaId)
            .single()
        if (currentError) throw new Error(currentError.message)

        const catalogKind: CatalogKind = (input.catalog_kind ?? current.catalog_kind) === 'service'
            ? 'service'
            : 'product'
        const categoryId = input.category_id ?? current.category_id
        if (!categoryId) throw new Error('Selecione uma categoria')
        if (catalogKind === 'service' && current.stock_quantity > 0) {
            throw new Error('Zere o estoque físico antes de salvar o item como serviço')
        }
        const name = validateCatalogBasics(
            input.name ?? current.name,
            Number(input.price ?? current.price),
            input.status ?? current.status,
        )
        const refs = await resolveCatalogReferences(
            arenaId,
            categoryId,
            catalogKind,
            input.station_id === undefined ? current.station_id : input.station_id,
            input.station_type_id === undefined ? current.station_type_id : input.station_type_id,
        )
        const safePatch: UpdateProductDTO = {
            name,
            category_id: refs.category.id,
            item_type: refs.category.name,
            station_id: refs.stationId,
            station_type_id: refs.stationTypeId,
            price: Number(input.price ?? current.price),
            catalog_kind: catalogKind,
            status: input.status ?? current.status,
            updated_by: dbUserId,
            ...(catalogKind === 'service' ? { stock_quantity: 0 } : {}),
        }

        const repo = new SupabaseProductRepository(supabase)
        const data = await repo.update(productId, safePatch)

        revalidatePath(`/dashboard/settings/products/${arenaId}`)
        return { success: true, data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao atualizar produto'
        return { success: false, error: message, data: null }
    }
}

export async function deleteProductAction(arenaId: string, productId: string) {
    try {
        await assertArenaAdminAccess(arenaId)
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
    operation_id: string
    product_id: string
    arena_id: string
    quantity: number
    entry_date: string
    supplier: string
    description?: string
    invoice_number?: string
}) {
    try {
        await assertArenaBackofficeAccess(input.arena_id)
        const { dbUserId } = await requireAuthenticatedDbUser()
        const { data, error } = await stockRpc().rpc('register_product_stock_entry', {
            p_operation_id: input.operation_id,
            p_arena_id: input.arena_id,
            p_product_id: input.product_id,
            p_quantity: input.quantity,
            p_entry_date: input.entry_date,
            p_supplier: input.supplier,
            p_description: input.description ?? null,
            p_invoice_number: input.invoice_number ?? null,
            p_registered_by: dbUserId,
        })

        if (error) throw new Error(error.message)
        return { success: true, data }
    } catch (err) {
        const error = err instanceof Error ? err : new Error('Erro ao registrar entrada de estoque')
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
        const { error } = await stockRpc().rpc('register_product_stock_outflow', {
            p_arena_id: arenaId,
            p_product_id: productId,
            p_quantity: quantity,
            p_reference_type: referenceType,
            p_reference_id: referenceId ?? null,
            p_registered_by: dbUserId,
        })

        if (error) throw new Error(error.message)

        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao registrar saída de estoque'
        return { success: false, error: message }
    }
}

export async function restoreStockForOrderAction(orderId: string, arenaId: string, _userId?: string) {
    try {
        void _userId
        await assertStationOrderAccess(orderId, arenaId)
        const { dbUserId } = await requireAuthenticatedDbUser()
        const { data, error } = await stockRpc().rpc('cancel_station_order', {
            p_arena_id: arenaId,
            p_order_id: orderId,
            p_registered_by: dbUserId,
        })

        if (error) throw new Error(error.message)
        return { success: true, data: Array.isArray(data) ? data[0] : data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao restaurar estoque'
        return { success: false, error: message }
    }
}
