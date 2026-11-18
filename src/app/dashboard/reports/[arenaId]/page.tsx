import { loadArenaResources } from '@/lib/server-auth'
import { redirect } from 'next/navigation'

export default async function ReportsArenaPage({ params }: { params: Promise<{ arenaId: string }> }) {
  const { arenaId } = await params
  const grants = await loadArenaResources(arenaId)
  if (grants.includes('reports.payments')) redirect(`/dashboard/reports/${arenaId}/status-pagamentos`)
  if (grants.includes('reports.customers')) redirect(`/dashboard/reports/${arenaId}/clientes-overview`)
  if (grants.includes('reports.stations')) redirect(`/dashboard/reports/${arenaId}/movimentacao-estacoes`)
  redirect('/dashboard')
}
