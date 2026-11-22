'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmActionDialog } from '@/components/dashboard/ConfirmActionDialog'
import { trackAction } from '@/lib/telemetry/client'
import type { ArenaSubscription } from '@/modules/payments/usecases/get-subscription.usecase'

const endpoint = '/api/payments/subscriptions/withdrawal'
const cancellationSchema = z.object({
  mode: z.enum(['withdrawal', 'renewal', 'review', 'unavailable']),
  currentPeriodEnd: z.union([z.iso.date(), z.iso.datetime({ offset: true })]).nullable(),
  deadlineAt: z.iso.datetime({ offset: true }).nullable(),
  refundAmountCents: z.int().nonnegative().nullable(),
  confirmation: z.string().min(1).nullable(),
  request: z.object({
    id: z.string().min(1),
    status: z.string(),
    requestedAt: z.iso.datetime({ offset: true }),
    refundAmountCents: z.int().nonnegative().nullable(),
  }).nullable(),
})
type Cancellation = z.infer<typeof cancellationSchema>
type CancellationDecision = Cancellation & { confirmation: string; mode: Exclude<Cancellation['mode'], 'unavailable'> }

const statusMessages = new Map([
  ['awaiting_review', {
    title: 'Em análise',
    detail: 'A Arena Digital recebeu o pedido e vai avaliar a desistência.',
  }],
  ['processing', {
    title: 'Em processamento',
    detail: 'Estamos processando a desistência.',
  }],
  ['refund_pending', {
    title: 'Aguardando confirmação do estorno',
    detail: 'O prazo para o crédito aparecer depende da forma de pagamento.',
  }],
  ['completed', {
    title: 'Concluído',
    detail: 'O pedido de desistência foi concluído.',
  }],
  ['rejected', {
    title: 'Pedido recusado',
    detail: 'Se tiver dúvidas sobre a análise, fale com o suporte e informe o protocolo.',
  }],
  ['escalated', {
    title: 'Encaminhado para atendimento',
    detail: 'O suporte da Arena Digital vai tratar o pedido.',
  }],
])

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})
const date = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})
const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

class CancellationAccessError extends Error {}

async function readCancellation(response: Response) {
  if ([401, 403].includes(response.status)) throw new CancellationAccessError()
  if (!response.ok) throw new Error('Falha ao consultar o cancelamento.')
  return cancellationSchema.parse(await response.json())
}

function renewalAccessText(currentPeriodEnd: string | null) {
  if (!currentPeriodEnd) return 'O acesso segue ativo até o fim do ciclo atual.'
  const endDate = currentPeriodEnd.length === 10
    ? currentPeriodEnd.split('-').reverse().join('/')
    : date.format(new Date(currentPeriodEnd))
  return `O acesso segue ativo até ${endDate}.`
}

function confirmationCopy(decision: CancellationDecision) {
  switch (decision.mode) {
    case 'withdrawal':
      return {
        description: `A assinatura será encerrada imediatamente e o estorno integral de ${currency.format((decision.refundAmountCents ?? 0) / 100)} será solicitado pelo meio de pagamento usado na compra. Você pode acompanhar a confirmação do estorno nesta página.`,
        label: 'Encerrar e estornar',
      }
    case 'renewal':
      return {
        description: `A renovação automática será desativada. ${renewalAccessText(decision.currentPeriodEnd)}`,
        label: 'Desativar renovação',
      }
    case 'review':
      return {
        description: 'A Arena Digital vai conferir a contratação e o prazo para decidir se cabe o encerramento com estorno integral. Você receberá um protocolo para acompanhar o pedido nesta página.',
        label: 'Enviar para análise',
      }
  }
}

function cancellationDecision(data: Cancellation | undefined): CancellationDecision | null {
  if (!data?.confirmation || data.mode === 'unavailable') return null
  if (data.mode === 'withdrawal' && !data.refundAmountCents) return null
  return { ...data, mode: data.mode, confirmation: data.confirmation }
}

type Props = {
  arenaId: string
  hasSubscription: boolean
  isFreeTrial: boolean
  actionLoading: boolean
  refreshSubscription: () => Promise<ArenaSubscription | null>
  onReactivate?: () => Promise<void>
}

export function SubscriptionWithdrawal({
  arenaId, hasSubscription, isFreeTrial, actionLoading, refreshSubscription, onReactivate,
}: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const sendingRef = useRef(false)
  const notifiedCompletion = useRef<string | null>(null)
  const [dialogDecision, setDialogDecision] = useState<CancellationDecision | null>(null)
  const [sending, setSending] = useState(false)
  const [submissionMessage, setSubmissionMessage] = useState<'changed' | 'error' | null>(null)
  const queryClient = useQueryClient()
  const queryKey = ['subscription-withdrawal', arenaId] as const
  const { data, error, isError, isFetching, isPending, refetch } = useQuery({
    queryKey,
    queryFn: async ({ signal }) => await readCancellation(await fetch(
      `${endpoint}?${new URLSearchParams({ arenaId })}`,
      { cache: 'no-store', signal }
    )),
    retry: false,
    gcTime: 0,
    refetchInterval: ({ state }) => {
      if (state.error instanceof CancellationAccessError) return false
      const status = state.data?.request?.status
      return status === 'processing' || status === 'refund_pending' ? 15_000 : false
    },
  })

  const accessDenied = error instanceof CancellationAccessError
  const request = accessDenied ? null : data?.request
  const completedId = request?.status === 'completed' ? request.id : null
  const blocksActions = Boolean(request && request.status !== 'rejected')
  const decision = isError || blocksActions ? null : cancellationDecision(data)
  const canReactivate = !isPending && !isError && !blocksActions && onReactivate
  const canCancel = decision && (decision.mode !== 'renewal' || !onReactivate)
  const dialogCopy = dialogDecision ? confirmationCopy(dialogDecision) : null
  const deadlineAt = data?.deadlineAt ?? null
  const status = statusMessages.get(request?.status ?? '') ?? {
    title: 'Pedido recebido',
    detail: 'Você pode acompanhar o pedido nesta página.',
  }

  useEffect(() => {
    if (!completedId || notifiedCompletion.current === completedId) return
    notifiedCompletion.current = completedId
    void refreshSubscription()
  }, [completedId, refreshSubscription])

  function confirmRenewalCancellation(currentPeriodEnd: string | null) {
    trackAction('subscription_cancel', 'success', { arena_id: arenaId })
    toast.success(`Renovação cancelada. ${renewalAccessText(currentPeriodEnd)}`)
  }

  async function submit() {
    if (sendingRef.current || !dialogDecision || accessDenied) return

    const submitted = dialogDecision
    sendingRef.current = true
    setSending(true)
    setSubmissionMessage(null)

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arenaId, confirmation: submitted.confirmation }),
      })

      if (response.status === 409) {
        const conflict = await response.json().catch(() => null)
        if (conflict?.code === 'cancellation_changed') {
          setDialogDecision(null)
          setSubmissionMessage('changed')
          await refetch()
          return
        }
      }

      const confirmed = await readCancellation(response)
      if (submitted.mode !== 'renewal' && !confirmed.request) {
        throw new Error('Protocolo ainda não confirmado.')
      }
      await queryClient.cancelQueries({ queryKey })
      queryClient.setQueryData(queryKey, confirmed)
      if (submitted.mode === 'renewal' && (!confirmed.request || confirmed.request.status === 'rejected')) {
        confirmRenewalCancellation(confirmed.currentPeriodEnd)
        await refreshSubscription()
      } else if (submitted.mode !== 'review' && confirmed.request?.status !== 'completed') {
        void refreshSubscription()
      }
    } catch {
      const reconciled = await refetch()
      const recorded = reconciled.isError ? null : reconciled.data?.request
      if (submitted.mode === 'renewal') {
        if (recorded && recorded.status !== 'rejected') return
        const subscription = await refreshSubscription()
        if (subscription?.cancelAtPeriodEnd && subscription.status !== 'canceled') {
          confirmRenewalCancellation(subscription.currentPeriodEnd)
        } else {
          trackAction('subscription_cancel', 'failure', { arena_id: arenaId, source: 'unconfirmed' })
          setSubmissionMessage('error')
        }
      } else if (!recorded) {
        setSubmissionMessage('error')
      } else if (submitted.mode === 'withdrawal' && recorded.status !== 'completed') {
        void refreshSubscription()
      }
    } finally {
      setDialogDecision(null)
      sendingRef.current = false
      setSending(false)
    }
  }

  if (!hasSubscription && !request && !canCancel) return null

  return (
    <section className="space-y-3 border-t border-slate-200 pt-4" aria-labelledby="subscription-withdrawal-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h4
            id="subscription-withdrawal-title"
            ref={headingRef}
            tabIndex={-1}
            className="text-sm font-semibold text-arena-navy-800"
          >
            Cancelamento da assinatura
          </h4>
          {canCancel && (
            <p className="text-sm text-muted-foreground">
              Confira as condições do seu plano antes de confirmar o cancelamento.
            </p>
          )}
          {canCancel && decision.mode === 'review' && deadlineAt && (
            <p className="text-sm text-muted-foreground">
              Pelo pagamento registrado, o prazo estimado vai até{' '}
              <time dateTime={deadlineAt} className="font-medium text-arena-navy-800">
                {dateTime.format(new Date(deadlineAt))}
              </time>.
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-start gap-2">
          {canCancel && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-slate-300 text-arena-navy-800"
              disabled={sending || actionLoading}
              onClick={() => {
                setSubmissionMessage(null)
                setDialogDecision(decision)
              }}
            >
              Cancelar assinatura
            </Button>
          )}
          {canReactivate && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-arena-button"
              disabled={sending || actionLoading}
              onClick={async () => {
                await onReactivate()
                void refetch()
              }}
            >
              Manter assinatura
            </Button>
          )}
        </div>
      </div>

      {request && (
        <div role="status" className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <Badge
            variant="outline"
            className="max-w-full whitespace-normal border-teal-200 bg-white text-teal-900"
          >
            {status.title}
          </Badge>
          <p className="text-slate-700">{status.detail}</p>
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-muted-foreground">Protocolo</dt>
              <dd className="break-all font-medium">{request.id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Recebido em</dt>
              <dd className="font-medium">
                <time dateTime={request.requestedAt}>{dateTime.format(new Date(request.requestedAt))}</time>
              </dd>
            </div>
            {request.status === 'completed' && Boolean(request.refundAmountCents) && (
              <div>
                <dt className="text-muted-foreground">Estorno confirmado</dt>
                <dd className="font-medium">{currency.format((request.refundAmountCents ?? 0) / 100)}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {isPending && <p role="status" className="text-sm text-muted-foreground">Consultando disponibilidade…</p>}
      {accessDenied && <p className="text-sm text-muted-foreground">Sua conta não tem acesso ao cancelamento.</p>}
      {isError && !accessDenied && (
        <p role="alert" className="text-sm text-red-700">Não foi possível consultar o cancelamento.</p>
      )}
      {!isError && !request && !canReactivate && data && !canCancel && (
        <p className="text-sm text-muted-foreground">
          {isFreeTrial
            ? 'O período de teste é gratuito. Se houve uma cobrança, fale com o suporte.'
            : 'O cancelamento está indisponível para esta contratação.'}
        </p>
      )}
      {submissionMessage === 'changed' && (
        <p role="status" className="text-sm text-arena-navy-800">
          As condições do cancelamento mudaram. Confira a situação atual antes de confirmar novamente.
        </p>
      )}
      {submissionMessage === 'error' && !accessDenied && (
        <p role="alert" className="text-sm text-red-700">
          Não conseguimos confirmar o cancelamento. Confira a situação antes de tentar novamente.
        </p>
      )}
      {!accessDenied && (request || isError) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 text-teal-800"
          disabled={isFetching || sending}
          onClick={() => void refetch()}
        >
          {isFetching ? 'Consultando…' : request ? 'Atualizar status' : 'Tentar novamente'}
        </Button>
      )}

      <ConfirmActionDialog
        open={Boolean(dialogCopy) && !accessDenied}
        onOpenChange={(open) => {
          if (!open && !sendingRef.current) setDialogDecision(null)
        }}
        title="Cancelar assinatura"
        description={dialogCopy?.description ?? ''}
        cancelLabel="Voltar"
        confirmLabel={dialogCopy?.label ?? 'Confirmar cancelamento'}
        loadingLabel="Enviando…"
        loading={sending}
        onConfirm={async () => {
          await submit()
          headingRef.current?.focus()
        }}
      />
    </section>
  )
}
