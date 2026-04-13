import { assertArenaAccess } from '@/lib/server-auth'
import { getStationWithOrdersAction } from '@/modules/stations/actions/stationActions'
import { StationDetailPageClient } from './StationDetailPageClient'
import { redirect } from 'next/navigation'

export default async function StationInternalPage({ params }: { params: Promise<{ id: string; stationId: string }> }) {
    const { id, stationId } = await params

    try {
        await assertArenaAccess(id)
    } catch {
        redirect(`/dashboard/arenas/${id}/stations`)
    }

    const result = await getStationWithOrdersAction(id, stationId)

    if (!result.success || !result.station) redirect(`/dashboard/arenas/${id}/stations`)

    return (
        <StationDetailPageClient
            arenaId={id}
            stationId={stationId}
            initialStation={result.station}
            initialOrders={result.orders}
        />
    )
}
