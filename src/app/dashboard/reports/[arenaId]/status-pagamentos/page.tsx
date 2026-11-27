import { redirect } from 'next/navigation'
import { assertArenaResourceAccess } from '@/lib/server-auth'
import { getPaymentStatusReportAction } from '@/modules/reports/actions/reportActions'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { getArenaBillingAddress } from '@/modules/arenas/usecases/get-arena-billing-address.usecase'
import { StatusPagamentosPageClient } from '@/modules/reports/components/StatusPagamentosPageClient'
import type { PaymentStatusArenaInfo } from '@/modules/reports/types/report.types'
import { format, startOfMonth, endOfMonth } from 'date-fns'

export default async function StatusPagamentosPage({
  params,
}: {
  params: Promise<{ arenaId: string }>
}) {
  const { arenaId } = await params

  let podeEditarMensalistas = false
  try {
    const access = await assertArenaResourceAccess(arenaId, 'reports.payments')
    podeEditarMensalistas = access.resources.includes('bookings.recurring')
  } catch {
    redirect('/dashboard/settings/arenas')
  }

  const now = new Date()
  const startDate = format(startOfMonth(now), 'yyyy-MM-dd')
  const endDate = format(endOfMonth(now), 'yyyy-MM-dd')

  const [result, arenaResult, billingAddress] = await Promise.all([
    getPaymentStatusReportAction(arenaId, { startDate, endDate }),
    getSupabaseAdmin().from('arenas').select('name,phone,email').eq('id', arenaId).maybeSingle(),
    getArenaBillingAddress(arenaId),
  ])

  // Cabeçalho do PDF exportado (5.16): nome/contato da arena vêm de `arenas`,
  // endereço já resolvido (cidade/UF) pelo mesmo usecase da tela de assinatura.
  const arenaInfo: PaymentStatusArenaInfo = {
    name: arenaResult.data?.name ?? 'Arena',
    phone: arenaResult.data?.phone ?? null,
    email: arenaResult.data?.email ?? null,
    cpfCnpj: billingAddress.cpfCnpj,
    street: billingAddress.street,
    number: billingAddress.number,
    complement: billingAddress.complement,
    neighborhood: billingAddress.neighborhood,
    city: billingAddress.city,
    stateUf: billingAddress.stateUf,
  }

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
        totalACobrar: 0,
        totalHoras: 0,
      }}
      initialAthleteSummaries={result.athleteSummaries ?? []}
      initialCourts={result.courts ?? []}
      initialSports={result.sports ?? []}
      initialStartDate={startDate}
      initialEndDate={endDate}
      arenaInfo={arenaInfo}
      initialCreditos={result.creditos ?? []}
      podeEditarMensalistas={podeEditarMensalistas}
    />
  )
}
