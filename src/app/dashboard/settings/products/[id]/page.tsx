import { assertArenaAdminAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { SupabaseArenaRepository } from '@/modules/arenas/repositories/SupabaseArenaRepository'
import { SupabaseProductRepository } from '@/modules/products/repositories/SupabaseProductRepository'
import { ProductsPageClient } from '@/modules/products/components/ProductsPageClient'
import type { ProductCategory } from '@/modules/products/types/product.types'
import { redirect } from 'next/navigation'
import { buildTutorialProducts, buildTutorialProductCategories } from '@/lib/tutorial-mock-data'

export default async function ArenaProductsPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>
    searchParams: Promise<{ tutorial?: string }>
}) {
    const { id: arenaId } = await params
    const { tutorial } = await searchParams

    try {
        await assertArenaAdminAccess(arenaId)
    } catch {
        redirect('/dashboard/settings/arenas')
    }

    if (tutorial === '1') {
        return (
            <ProductsPageClient
                arenaId={arenaId}
                arenaName="Arena demonstrativa"
                initialProducts={buildTutorialProducts(arenaId)}
                initialStationTypes={[
                    { id: 'tutorial-station-type-1', name: 'Bar' },
                    { id: 'tutorial-station-type-2', name: 'Loja' },
                ]}
                initialCategories={buildTutorialProductCategories(arenaId)}
            />
        )
    }

    const supabase = getSupabaseAdmin()
    const [arena, products, stationTypesResult, categoriesResult] = await Promise.all([
        new SupabaseArenaRepository(supabase).findById(arenaId),
        new SupabaseProductRepository(supabase).findByArena(arenaId),
        supabase.from("station_types").select("id, name").order("name", { ascending: true }),
        supabase
            .from("product_categories")
            .select("*")
            .eq("arena_id", arenaId)
            .order("kind", { ascending: true })
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true }),
    ])

    if (stationTypesResult.error) {
        console.error("station_types:", stationTypesResult.error.message)
    }
    if (categoriesResult.error) {
        console.error("product_categories:", categoriesResult.error.message)
    }

    const initialStationTypes =
        (stationTypesResult.data as { id: string; name: string }[] | null) ?? []
    const initialCategories = (categoriesResult.data as ProductCategory[] | null) ?? []

    return (
        <ProductsPageClient
            arenaId={arenaId}
            arenaName={arena?.name ?? ''}
            initialProducts={products}
            initialStationTypes={initialStationTypes}
            initialCategories={initialCategories}
        />
    )
}
