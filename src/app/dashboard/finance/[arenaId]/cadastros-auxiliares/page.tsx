import { redirect } from 'next/navigation'
import { assertArenaAdminAccess } from '@/lib/server-auth'
import { getTransactionCategoriesAction } from '@/modules/finance/actions/transactionCategoryActions'
import { CadastrosAuxiliaresPageClient } from '@/modules/finance/components/CadastrosAuxiliaresPageClient'

export default async function CadastrosAuxiliaresPage({ params }: { params: Promise<{ arenaId: string }> }) {
    const { arenaId } = await params

    try {
        await assertArenaAdminAccess(arenaId)
    } catch {
        redirect('/dashboard/settings/arenas')
    }

    const { data: initialCategories } = await getTransactionCategoriesAction(arenaId)

    return <CadastrosAuxiliaresPageClient arenaId={arenaId} initialCategories={initialCategories} />
}
