import { assertArenaAccess } from '@/lib/server-auth'
import { getStationsWithMetricsAction } from '@/modules/stations/actions/stationActions'
import { StationsPageClient } from './StationsPageClient'
import { redirect } from 'next/navigation'

export default async function StationsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    try {
        await assertArenaAccess(id)
    } catch {
        redirect('/dashboard/settings/arenas')
    }

    const result = await getStationsWithMetricsAction(id)

    return (
        <StationsPageClient
            arenaId={id}
            initialStations={result.data ?? []}
        />
    )
}
