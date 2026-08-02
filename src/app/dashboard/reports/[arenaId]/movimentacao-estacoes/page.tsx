import { redirect } from 'next/navigation'
import { assertArenaAdminAccess } from '@/lib/server-auth'
import { getStationMovementReportAction } from '@/modules/reports/actions/stationMovementActions'
import { MovimentacaoEstacoesPageClient } from '@/modules/reports/components/MovimentacaoEstacoesPageClient'

export default async function MovimentacaoEstacoesPage({
  params,
}: {
  params: Promise<{ arenaId: string }>
}) {
  const { arenaId } = await params

  try {
    await assertArenaAdminAccess(arenaId)
  } catch {
    redirect('/dashboard/settings/arenas')
  }

  const result = await getStationMovementReportAction(arenaId, {})

  return (
    <MovimentacaoEstacoesPageClient
      arenaId={arenaId}
      initialRows={result.rows ?? []}
      initialStations={result.stations ?? []}
    />
  )
}
