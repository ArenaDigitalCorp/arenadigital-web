import { redirect } from 'next/navigation'
import { assertArenaBackofficeAccess } from '@/lib/server-auth'
import { getTurmasPageDataAction } from '@/modules/turmas/actions'
import { TurmasPageClient } from '@/modules/turmas/components/TurmasPageClient'

export default async function TurmasPage({ params }: { params: Promise<{ arenaId: string }> }) {
  const { arenaId } = await params

  try {
    await assertArenaBackofficeAccess(arenaId)
  } catch {
    redirect('/dashboard/settings/arenas')
  }

  const res = await getTurmasPageDataAction(arenaId)

  if (!res.success) {
    return (
      <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <p className="font-semibold">Não foi possível carregar as turmas.</p>
        <p>{res.error}</p>
        <a href={`/dashboard/turmas/${arenaId}`} className="inline-block font-semibold underline">
          Tentar novamente
        </a>
      </div>
    )
  }

  return <TurmasPageClient arenaId={arenaId} dados={res.data} />
}
