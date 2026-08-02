import { assertArenaAccess } from '@/lib/server-auth'
import { getStationsWithMetricsAction } from '@/modules/stations/actions/stationActions'
import { StationsPageClient } from '@/modules/stations/components/StationsPageClient'
import { redirect } from 'next/navigation'
import { buildTutorialStations } from '@/lib/tutorial-mock-data'
import { canManageArena } from '@/lib/arena-permissions'

export default async function StationsPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>
    searchParams: Promise<{ tutorial?: string }>
}) {
    const { id } = await params
    const { tutorial } = await searchParams
    let access: Awaited<ReturnType<typeof assertArenaAccess>> | null = null

    try {
        access = await assertArenaAccess(id)
    } catch {
        redirect('/dashboard/settings/arenas')
    }

    if (!access.isOwner && access.role === 'Caixa' && access.assignedStationId) {
        redirect(`/dashboard/arenas/${id}/stations/${access.assignedStationId}`)
    }

    const result = tutorial === '1'
        ? { data: buildTutorialStations(id) }
        : await getStationsWithMetricsAction(id)

    return (
        <StationsPageClient
            arenaId={id}
            initialStations={result.data ?? []}
            canManage={canManageArena(access)}
        />
    )
}
