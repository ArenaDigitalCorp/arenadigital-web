import { assertArenaBackofficeAccess } from '@/lib/server-auth'
import { redirect } from 'next/navigation'
import { MensalistasOverviewClient } from '@/modules/mensalistas/components/MensalistasOverviewClient'
import { MensalistasPageClient } from '@/modules/bookings/components/MensalistasPageClient'
import { getMensalistasOverviewAction } from '@/modules/mensalistas/actions/mensalistaActions'
import { buildTutorialMonthlyPlans } from '@/lib/tutorial-mock-data'
import { toCompetencia } from '@/lib/format'

export default async function MensalistasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tutorial?: string; competencia?: string }>
}) {
  const { id: arenaId } = await params
  const { tutorial, competencia } = await searchParams

  try {
    await assertArenaBackofficeAccess(arenaId)
  } catch {
    redirect('/dashboard/settings/arenas')
  }

  if (tutorial === '1') {
    return (
      <MensalistasPageClient
        arenaId={arenaId}
        initialPlanos={buildTutorialMonthlyPlans(arenaId)}
      />
    )
  }

  const comp = /^\d{4}-\d{2}$/.test(competencia ?? '')
    ? (competencia as string)
    : toCompetencia()

  const res = await getMensalistasOverviewAction(arenaId, comp)

  if (!res.success || !res.data) {
    return (
      <div className="p-8 text-sm text-red-600">
        {res.error ?? 'Erro ao carregar mensalistas.'}
      </div>
    )
  }

  return (
    <MensalistasOverviewClient
      arenaId={arenaId}
      competencia={comp}
      overview={res.data}
    />
  )
}
