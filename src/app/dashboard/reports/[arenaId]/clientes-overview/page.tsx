import { redirect } from 'next/navigation'
import { assertArenaAdminAccess } from '@/lib/server-auth'
import { getClientesOverviewAction } from '@/modules/reports/actions/clientesOverviewActions'
import { ClientesOverviewPageClient } from '@/modules/reports/components/ClientesOverviewPageClient'
import { tutorialReportCategories } from '@/lib/tutorial-mock-data'

export default async function ClientesOverviewPage({
    params,
    searchParams,
}: {
    params: Promise<{ arenaId: string }>
    searchParams: Promise<{ tutorial?: string }>
}) {
    const { arenaId } = await params
    const { tutorial } = await searchParams

    try {
        await assertArenaAdminAccess(arenaId)
    } catch {
        redirect('/dashboard/settings/arenas')
    }

    if (tutorial === '1') {
        return <ClientesOverviewPageClient arenaId={arenaId} initialCategories={tutorialReportCategories} />
    }

    const result = await getClientesOverviewAction(arenaId)

    return (
        <ClientesOverviewPageClient
            arenaId={arenaId}
            initialCategories={result.categories ?? []}
        />
    )
}
