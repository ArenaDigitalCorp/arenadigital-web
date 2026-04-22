import { redirect } from 'next/navigation'
import { assertArenaBackofficeAccess } from '@/lib/server-auth'
import { getPaymentStatusReportAction } from '@/modules/reports/actions/reportActions'
import { StatusPagamentosPageClient } from './StatusPagamentosPageClient'
import { format, startOfMonth, endOfMonth } from 'date-fns'

export default async function StatusPagamentosPage({
  params,
}: {
  params: Promise<{ arenaId: string }>
}) {
  const { arenaId } = await params

  try {
    await assertArenaBackofficeAccess(arenaId)
  } catch {
    redirect('/dashboard/settings/arenas')
  }

  const now = new Date()
  const startDate = format(startOfMonth(now), 'yyyy-MM-dd')
  const endDate = format(endOfMonth(now), 'yyyy-MM-dd')

  const result = await getPaymentStatusReportAction(arenaId, { startDate, endDate })

  return (
    <StatusPagamentosPageClient
      arenaId={arenaId}
      initialRows={result.rows ?? []}
      initialSummary={result.summary ?? {
        totalPago: 0,
        totalPendente: 0,
        totalCancelado: 0,
        countPago: 0,
        countPendente: 0,
        countCancelado: 0,
      }}
      initialCourts={result.courts ?? []}
      initialSports={result.sports ?? []}
      initialStartDate={startDate}
      initialEndDate={endDate}
    />
  )
}
