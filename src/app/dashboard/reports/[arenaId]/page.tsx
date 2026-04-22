import { redirect } from 'next/navigation'

export default async function ReportsArenaPage({ params }: { params: Promise<{ arenaId: string }> }) {
  const { arenaId } = await params
  redirect(`/dashboard/reports/${arenaId}/status-pagamentos`)
}
