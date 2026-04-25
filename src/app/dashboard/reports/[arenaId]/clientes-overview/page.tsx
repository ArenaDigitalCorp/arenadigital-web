import { redirect } from 'next/navigation'
import { assertArenaBackofficeAccess } from '@/lib/server-auth'
import { getClientesOverviewAction } from '@/modules/reports/actions/clientesOverviewActions'
import { ClientesOverviewPageClient } from './ClientesOverviewPageClient'

export default async function ClientesOverviewPage({
    params,
}: {
    params: Promise<{ arenaId: string }>
}) {
    const { arenaId } = await params

    try {
        await assertArenaBackofficeAccess(arenaId)
    } catch {
        redirect('/dashboard/settings/arenas')
    }

    const result = await getClientesOverviewAction(arenaId)

    return (
        <ClientesOverviewPageClient
            arenaId={arenaId}
            initialCategories={result.categories ?? []}
        />
    )
}
