import { assertArenaBackofficeAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { SupabaseArenaRepository } from '@/modules/arenas/repositories/SupabaseArenaRepository'
import { SupabaseProductRepository } from '@/modules/products/repositories/SupabaseProductRepository'
import { ProductsPageClient } from './ProductsPageClient'
import { redirect } from 'next/navigation'

export default async function ArenaProductsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: arenaId } = await params

    try {
        await assertArenaBackofficeAccess(arenaId)
    } catch {
        redirect('/dashboard/settings/arenas')
    }

    const supabase = getSupabaseAdmin()
    const [arena, products] = await Promise.all([
        new SupabaseArenaRepository(supabase).findById(arenaId),
        new SupabaseProductRepository(supabase).findByArena(arenaId),
    ])

    return (
        <ProductsPageClient
            arenaId={arenaId}
            arenaName={arena?.name ?? ''}
            initialProducts={products}
        />
    )
}
