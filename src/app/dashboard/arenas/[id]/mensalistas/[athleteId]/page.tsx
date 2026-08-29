import { assertArenaBackofficeAccess } from '@/lib/server-auth'
import { redirect } from 'next/navigation'
import { MensalistaDetailClient } from '@/modules/mensalistas/components/MensalistaDetailClient'
import { getMensalistaDetailAction } from '@/modules/mensalistas/actions/mensalistaActions'
import { getModoPagamentoAction } from '@/modules/finance/actions/financeActions'
import { toCompetencia } from '@/lib/format'

export default async function MensalistaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; athleteId: string }>
  searchParams: Promise<{ competencia?: string }>
}) {
  const { id: arenaId, athleteId } = await params
  const { competencia } = await searchParams

  try {
    await assertArenaBackofficeAccess(arenaId)
  } catch {
    redirect('/dashboard/settings/arenas')
  }

  const comp = /^\d{4}-\d{2}$/.test(competencia ?? '')
    ? (competencia as string)
    : toCompetencia()

  const [detail, modos] = await Promise.all([
    getMensalistaDetailAction(arenaId, athleteId, comp),
    getModoPagamentoAction(),
  ])

  if (!detail.success || !detail.data) {
    return (
      <div className="p-8 text-sm text-red-600">
        {detail.error ?? 'Mensalista não encontrado.'}
      </div>
    )
  }

  return (
    <MensalistaDetailClient
      arenaId={arenaId}
      athleteId={athleteId}
      competencia={comp}
      detalhe={detail.data}
      modosPagamento={modos.data ?? []}
    />
  )
}
