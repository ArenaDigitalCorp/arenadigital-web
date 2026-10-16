import { Suspense } from 'react'
import { RotativoCreditsError } from '@/modules/rotativos/components/RotativoCreditsError'
import { CreditosTab } from '@/modules/rotativos/components/CreditosTab'
import { assertArenaBackofficeAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { SupabaseArenaRepository } from '@/modules/arenas/repositories/SupabaseArenaRepository'
import { SupabaseRotativoRepository } from '@/modules/rotativos/repositories/SupabaseRotativoRepository'
import { RotativoPageClient } from '@/modules/rotativos/components/RotativoPageClient'
import { redirect } from 'next/navigation'
import { buildTutorialRotativos } from '@/lib/tutorial-mock-data'

async function CreditContent({ data }: {
  data: Promise<{ ok: true; value: Awaited<ReturnType<typeof loadCredits>> } | { ok: false; error: unknown }>
}) {
  const result = await data
  if (!result.ok) {
    console.error('Rotativo credit read failed:', result.error)
    return <RotativoCreditsError />
  }
  const [pacotes, movements, topAthletes, arenaId] = result.value
  return <CreditosTab arenaId={arenaId} initialPacotes={pacotes} initialMovements={movements.rows}
    initialMovementsTotal={movements.total} initialTopAthletes={topAthletes} />
}

async function loadCredits(repo: SupabaseRotativoRepository, arenaId: string) {
  return Promise.all([repo.getPacotes(arenaId), repo.getCreditMovements(arenaId, { page: 1, pageSize: 10 }),
    repo.getTopAthletesByCredit(arenaId, 5), Promise.resolve(arenaId)] as const)
}

export default async function RotativoPage({
  params,
  searchParams,
}: {
  params: Promise<{ arenaId: string }>
  searchParams: Promise<{ tutorial?: string }>
}) {
  const { arenaId } = await params
  const { tutorial } = await searchParams

  try {
    await assertArenaBackofficeAccess(arenaId)
  } catch {
    redirect('/dashboard/settings/arenas')
  }

  if (tutorial === '1') {
    const tutorialRotativos = buildTutorialRotativos(arenaId)
    return (
      <RotativoPageClient
        arenaId={arenaId}
        sports={[
          { id: 'tutorial-sport-1', name: 'Beach Tennis' },
          { id: 'tutorial-sport-2', name: 'Futevolei' },
        ]}
        courts={[
          { id: 'tutorial-court-1', name: 'Quadra Beach 01' },
          { id: 'tutorial-court-2', name: 'Quadra Beach 02' },
        ]}
        initialRotativos={tutorialRotativos}
        initialRotativosTotal={tutorialRotativos.length}
        creditContent={<CreditosTab arenaId={arenaId} initialPacotes={[]} initialMovements={[]}
          initialMovementsTotal={0} initialTopAthletes={[]} />}
      />
    )
  }

  const supabase = getSupabaseAdmin()
  const arenaRepo = new SupabaseArenaRepository(supabase)
  const repo = new SupabaseRotativoRepository(supabase)

  // Credit reads start immediately, but their server-rendered content is streamed
  // independently so that the sessions table does not wait for reconciliation.
  const credits = loadCredits(repo, arenaId).then(
    value => ({ ok: true as const, value }),
    error => ({ ok: false as const, error }),
  )
  const [arena, rotativosList, courts] = await Promise.all([
    arenaRepo.findById(arenaId),
    repo.list(arenaId, { page: 1, pageSize: 10 }),
    repo.getCourts(arenaId),
  ])

  return (
    <RotativoPageClient
      arenaId={arenaId}
      sports={arena?.sports ?? []}
      courts={courts}
      initialRotativos={rotativosList.rows}
      initialRotativosTotal={rotativosList.total}
      creditContent={
        <Suspense fallback={<p role="status" className="py-8 text-center text-muted-foreground">Carregando créditos…</p>}>
          <CreditContent data={credits} />
        </Suspense>
      }
    />
  )
}
