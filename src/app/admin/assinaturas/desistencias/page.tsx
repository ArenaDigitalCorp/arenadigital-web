import Link from 'next/link'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/format'
import { assertPlatformSuperAdminAccess } from '@/lib/server-auth'
import {
  listSubscriptionWithdrawalReviews, previewSubscriptionWithdrawal, type WithdrawalReview,
} from '@/modules/payments/usecases/subscription-withdrawal.usecase'
import { reviewSubscriptionWithdrawal } from './actions'

const path = '/admin/assinaturas/desistencias'
const dates = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
})
const statuses: Record<WithdrawalReview['status'], string> = {
  awaiting_review: 'Em análise', processing: 'Em processamento', refund_pending: 'Aguardando Asaas',
  completed: 'Concluído', rejected: 'Indeferido', escalated: 'Precisa de conferência',
}
const outcomes = new Map([
  ['updated', 'Ação registrada. Confira a situação atual do pedido.'],
  ['invalid', 'Preencha a justificativa antes de registrar a decisão.'],
  ['error', 'A operação precisa de conferência. Consulte a situação antes de repetir a ação.'],
])

function showDate(date: string) {
  return dates.format(new Date(date))
}

export default async function SubscriptionWithdrawalQueue({ searchParams }: {
  searchParams: Promise<{ pedido?: string; resultado?: string }>
}) {
  const reviewer = await assertPlatformSuperAdminAccess()
  const params = await searchParams
  const requested = z.uuid().safeParse(params.pedido)
  const requestId = requested.success ? requested.data : undefined
  const queue = await listSubscriptionWithdrawalReviews(reviewer.authUserId, requestId)
  const outcome = outcomes.get(typeof params.resultado === 'string' ? params.resultado : '')
  const detail = requestId ? queue?.[0] : undefined
  const preview = detail?.status === 'awaiting_review' && detail.provider === 'asaas'
    ? await previewSubscriptionWithdrawal(detail).catch(() => null) : null

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Link href={requestId ? path : '/admin/finance'} className="text-sm font-semibold text-primary hover:underline">
          {requestId ? 'Todos os pedidos' : 'Financeiro'}
        </Link>
        <h1 className="font-heading text-3xl font-black">Desistências de assinaturas</h1>
        <p className="text-sm text-muted-foreground">Confira a contratação e registre se cabe a devolução integral do plano.</p>
      </header>
      {!requestId && (
        <form action={path} className="flex max-w-xl flex-wrap items-end gap-2">
          <label className="min-w-48 flex-1 space-y-1 text-sm font-medium">
            <span>Buscar por protocolo</span>
            <input type="search" name="pedido" required maxLength={36} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
          </label>
          <Button type="submit" variant="outline">Buscar</Button>
        </form>
      )}
      {outcome && <p role="status" className="rounded-xl border bg-card p-4 text-sm">{outcome}</p>}
      {queue === null && <p role="status" className="rounded-xl border bg-card p-4 text-sm">A consulta ainda não está disponível neste ambiente.</p>}
      {queue?.length === 0 && <p className="rounded-xl border bg-card p-4 text-sm">Nenhum pedido encontrado.</p>}
      <ul className="space-y-3" role="list">
        {queue?.map(row => (
          <li key={row.id} className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <Link href={`/admin/arenas/${row.arena_id}`} className="text-sm font-semibold hover:underline">Ver arena</Link>
                <p className="break-all text-xs text-muted-foreground">Protocolo {row.id}</p>
                <p className="text-xs text-muted-foreground">Pedido em {showDate(row.requested_at)} · {row.provider === 'asaas' ? 'Asaas' : 'Stripe'}</p>
              </div>
              <Badge variant="outline">{statuses[row.status]}</Badge>
            </div>
            {row.amount_cents && <p className="text-sm font-semibold">Valor integral {formatCurrency(row.amount_cents / 100)}</p>}
            {row.decision_source === 'automatic_policy' ? (
              <p className="text-sm text-muted-foreground">Desistência autorizada pela política de sete dias.</p>
            ) : row.review_reason && <p className="break-words text-sm">Justificativa registrada · {row.review_reason}</p>}
            {!requestId ? (
              <Button asChild variant="outline" size="sm"><Link href={`${path}?pedido=${row.id}`}>Abrir pedido</Link></Button>
            ) : row.status === 'awaiting_review' ? (
              <form action={reviewSubscriptionWithdrawal} className="space-y-3 border-t pt-4">
                <input type="hidden" name="requestId" value={row.id} />
                {preview ? (
                  <div className="space-y-1 text-sm">
                    <input type="hidden" name="paymentId" value={preview.paymentId} />
                    <input type="hidden" name="amountCents" value={preview.amountCents} />
                    <p>Primeira cobrança paga · <strong>{formatCurrency(preview.amountCents / 100)}</strong></p>
                    <p className="break-all text-xs text-muted-foreground">{preview.paymentId}</p>
                    <p className="text-xs text-muted-foreground">Pagamento em {showDate(preview.firstPaidAt)}</p>
                    {preview.deadlineAt && <p className="text-xs text-muted-foreground">Referência dos sete dias pelo checkout · {showDate(preview.deadlineAt)}</p>}
                    <p>Ao aprovar, a assinatura é encerrada e o estorno integral é solicitado ao Asaas.</p>
                  </div>
                ) : <p className="text-sm text-muted-foreground">A primeira cobrança precisa de conferência operacional antes de solicitar a devolução.</p>}
                <label className="block max-w-xl space-y-1 text-sm font-medium">
                  <span>Motivo da decisão</span>
                  <input name="reason" required maxLength={280} className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="Registre o enquadramento e o prazo, sem dados pessoais" />
                </label>
                <div className="flex flex-wrap gap-2">
                  {preview && <Button name="action" value="approve">Confirmar desistência e estorno integral</Button>}
                  <Button name="action" value="reject" variant="outline">Indeferir pedido</Button>
                </div>
              </form>
            ) : ['processing', 'refund_pending', 'escalated'].includes(row.status) ? (
              <form action={reviewSubscriptionWithdrawal} className="space-y-2 border-t pt-4">
                <input type="hidden" name="requestId" value={row.id} />
                {row.refund_requested_at && <p className="text-xs text-muted-foreground">O pedido de estorno já foi registrado. Esta ação consulta a devolução.</p>}
                <Button name="action" value="resume" variant="outline" size="sm">
                  {row.refund_requested_at ? 'Conferir no Asaas' : 'Retomar pedido aprovado'}
                </Button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
