import { createHash } from 'node:crypto'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AsaasWithdrawalGateway } from '@/modules/payments/gateway/asaas-withdrawal'
import { PaymentApiError, SubscriptionCancellationChangedError } from '@/modules/payments/errors'
import { EXPERIMENTAL_PLAN_KEY, PARTNER_PLAN_KEY } from '@/modules/payments/plans'
import type { RenewalCancellationExpectation } from './cancel-subscription.usecase'

const summarySchema = z.object({
  id: z.uuid(),
  status: z.enum(['awaiting_review', 'processing', 'refund_pending', 'completed', 'rejected', 'escalated']),
  requested_at: z.iso.datetime({ offset: true }),
  amount_cents: z.number().int().positive().nullable(),
})

const reviewSchema = summarySchema.extend({
  arena_id: z.uuid(),
  provider: z.enum(['asaas', 'stripe']),
  gateway_customer_id: z.string().nullable(),
  gateway_subscription_id: z.string().nullable(),
  gateway_payment_id: z.string().nullable(),
  renewal_stopped_at: z.string().nullable(),
  refund_requested_at: z.string().nullable(),
  first_paid_at: z.string().nullable(),
  review_reason: z.string().nullable().optional(),
  last_error_code: z.string().nullable().optional(),
  decision_source: z.enum(['automatic_policy', 'human_review']).nullable().optional(),
})

export type WithdrawalReview = z.infer<typeof reviewSchema>
type Summary = z.infer<typeof summarySchema>
type AdminDb = ReturnType<typeof getSupabaseAdmin>

function publicSummary(request: Summary | null) {
  return request && {
    id: request.id, status: request.status, requestedAt: request.requested_at,
    refundAmountCents: request.amount_cents,
  }
}

function migrationMissing(error: { code: string }) {
  return ['PGRST202', '42883'].includes(error.code)
}

const conflictingWithdrawalStates = new Set(['awaiting_review', 'processing', 'refund_pending', 'escalated'])

export async function hasActiveSubscriptionWithdrawal(arenaId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('get_my_arena_subscription_withdrawal', { p_arena_id: arenaId })
  if (error && migrationMissing(error)) return false
  if (error) throw error
  const state = summarySchema.nullable().parse(data)
  return Boolean(state && conflictingWithdrawalStates.has(state.status))
}

async function verifiedCheckout(db: AdminDb, arenaId: string, subscriptionId: string, customerId: string) {
  const { data, error } = await db.from('payment_checkout_attempts')
    .select('paid_at, provider, checkout_id')
    .eq('arena_id', arenaId)
    .eq('gateway_customer_id', customerId)
    .eq('result_gateway_subscription_id', subscriptionId)
    .eq('status', 'paid')
    .order('paid_at', { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', dateStyle: 'short' })

function proposedDeadline(paidAt?: string | null) {
  if (!paidAt || !Number.isFinite(Date.parse(paidAt))) return null
  const firstDay = localDate.format(new Date(paidAt))
  const lastDay = new Date(`${firstDay}T23:59:59.999-03:00`)
  lastDay.setUTCDate(lastDay.getUTCDate() + 7)
  return Number.isFinite(lastDay.getTime()) ? lastDay.toISOString() : null
}

type CancellationMode = 'withdrawal' | 'renewal' | 'review' | 'unavailable'
type CheckoutPayment = Awaited<ReturnType<AsaasWithdrawalGateway['findConfirmedCheckoutPayment']>>

const purchasePolicySchema = z.object({
  state: z.enum(['candidate', 'continuation', 'unverified']),
  checkout_id: z.string().nullable().optional(),
  checkout_paid_at: z.string().nullable().optional(),
  captured_at: z.string().nullable().optional(),
  gateway_customer_id: z.string().nullable().optional(),
  gateway_subscription_id: z.string().nullable().optional(),
})

type CancellationConfirmation = {
  token: string
  cancelRenewal: (expected: RenewalCancellationExpectation) => Promise<{ currentPeriodEnd: string | null }>
}

export async function subscriptionWithdrawalForArena(
  arenaId: string,
  actorAuthId: string,
  accepted?: CancellationConfirmation,
) {
  const evaluatedAt = Date.now()
  const db = getSupabaseAdmin()
  const viewer = await createSupabaseServerClient()
  const [current, existing] = await Promise.all([
    db.from('arena_subscriptions').select('gateway_subscription_id,gateway_customer_id,gateway_checkout_id,plan_key,status,current_period_end,cancel_at_period_end')
      .eq('arena_id', arenaId).maybeSingle(),
    viewer.rpc('get_my_arena_subscription_withdrawal', { p_arena_id: arenaId }),
  ])
  if (current.error) throw current.error
  if (existing.error) {
    if (migrationMissing(existing.error) && !accepted) {
      return {
        mode: 'unavailable' as const, currentPeriodEnd: null, deadlineAt: null,
        refundAmountCents: null, confirmation: null, request: null,
      }
    }
    throw existing.error
  }

  let request = summarySchema.nullable().parse(existing.data)
  const subscription = current.data
  let periodEnd = subscription?.current_period_end ?? null
  const unavailable = () => ({
    mode: 'unavailable' as const, currentPeriodEnd: periodEnd, deadlineAt: null,
    refundAmountCents: null, confirmation: null, request: publicSummary(request),
  })
  // Retries always return the prior protocol, even after the seven days or
  // after the provider confirms that this subscription was canceled.
  if (request && request.status !== 'rejected') return unavailable()
  if (!subscription || subscription.status === 'canceled'
    || (!subscription.gateway_subscription_id && !subscription.gateway_checkout_id)) {
    if (accepted) throw new SubscriptionCancellationChangedError()
    return unavailable()
  }

  const checkout = subscription.gateway_subscription_id && subscription.gateway_customer_id
    ? await verifiedCheckout(db, arenaId, subscription.gateway_subscription_id, subscription.gateway_customer_id)
    : null
  const knownNoRefund = request?.status === 'rejected' || subscription.plan_key === EXPERIMENTAL_PLAN_KEY
    || subscription.plan_key === PARTNER_PLAN_KEY
  const { data: policyData, error: policyError } = knownNoRefund
    ? { data: null, error: null }
    : await db.rpc('get_arena_subscription_withdrawal_policy', { p_arena_id: arenaId, p_actor_auth_id: actorAuthId })
  if (policyError && !migrationMissing(policyError)) throw policyError
  const policy = purchasePolicySchema.nullable().parse(policyData)

  const canonicalDeadline = proposedDeadline(policy?.checkout_paid_at)
  let mode: CancellationMode = knownNoRefund || (canonicalDeadline && evaluatedAt > Date.parse(canonicalDeadline))
    ? 'renewal' : 'review'
  let deadlineAt = canonicalDeadline ?? proposedDeadline(checkout?.paid_at)
  let payment: CheckoutPayment | null = null
  let gateway: AsaasWithdrawalGateway | undefined
  const lookupCheckoutId = policy?.checkout_id ?? checkout?.checkout_id
  const verifyLegacyDate = policy?.state !== 'candidate' && checkout?.provider === 'asaas'
    && deadlineAt && evaluatedAt > Date.parse(deadlineAt)
  if (mode === 'review' && lookupCheckoutId && subscription.gateway_customer_id && subscription.gateway_subscription_id
    && (policy?.state === 'candidate' || verifyLegacyDate)) {
    if (policy?.state === 'candidate' && (!policy.checkout_paid_at
      || policy.gateway_customer_id !== subscription.gateway_customer_id
      || policy.gateway_subscription_id !== subscription.gateway_subscription_id)) {
      throw new SubscriptionCancellationChangedError()
    }
    try {
      gateway = new AsaasWithdrawalGateway()
      const verified = await gateway.findConfirmedCheckoutPayment({
        checkoutId: lookupCheckoutId,
        customerId: subscription.gateway_customer_id,
        subscriptionId: subscription.gateway_subscription_id,
      })
      const activatedAt = policy?.checkout_paid_at ?? checkout?.paid_at
      const verifiedDay = localDate.format(new Date(verified.firstPaidAt))
      if (activatedAt && verifiedDay <= localDate.format(new Date(activatedAt))
        && (!policy?.captured_at || verifiedDay >= localDate.format(new Date(policy.captured_at)))) {
        payment = verified
        deadlineAt = proposedDeadline(activatedAt)
        if (deadlineAt && evaluatedAt > Date.parse(deadlineAt)) mode = 'renewal'
        else if (policy?.state === 'candidate' && payment.state === 'eligible' && deadlineAt) mode = 'withdrawal'
      }
    } catch {
      // Missing provider evidence leaves the request eligible for review.
    }
  }

  if (mode === 'renewal' && (!subscription.gateway_subscription_id || subscription.cancel_at_period_end)) {
    if (accepted) throw new SubscriptionCancellationChangedError()
    return unavailable()
  }

  // The digest is a version of the displayed offer, not authorization. The
  // server reloads every field and authorization is enforced independently.
  const withdrawalTerms = mode === 'renewal'
    ? []
    : [deadlineAt, policy?.checkout_id, payment?.paymentId, payment?.amountCents]
  const confirmation = createHash('sha256').update(JSON.stringify([
    arenaId, actorAuthId, subscription.gateway_subscription_id, subscription.gateway_customer_id,
    subscription.gateway_checkout_id, subscription.plan_key, subscription.status, subscription.cancel_at_period_end,
    periodEnd, mode, ...withdrawalTerms,
  ])).digest('hex')

  if (!accepted) {
    return {
      mode, currentPeriodEnd: periodEnd, deadlineAt,
      refundAmountCents: mode === 'withdrawal' ? payment?.amountCents ?? null : null,
      confirmation, request: publicSummary(request),
    }
  }
  if (accepted.token !== confirmation) throw new SubscriptionCancellationChangedError()

  if (mode === 'renewal' && subscription.gateway_subscription_id) {
    const result = await accepted.cancelRenewal({
      subscriptionId: subscription.gateway_subscription_id,
      customerId: subscription.gateway_customer_id,
      currentPeriodEnd: periodEnd,
    })
    periodEnd = result.currentPeriodEnd
    return unavailable()
  }

  if (mode === 'withdrawal' && payment && gateway && policy?.checkout_id && policy.gateway_customer_id && policy.gateway_subscription_id) {
    const { data, error } = await db.rpc('decide_arena_subscription_withdrawal_automatically', {
      p_arena_id: arenaId, p_actor_auth_id: actorAuthId, p_checkout_id: policy.checkout_id,
      p_gateway_customer_id: policy.gateway_customer_id, p_gateway_subscription_id: policy.gateway_subscription_id,
      p_gateway_payment_id: payment.paymentId, p_amount_cents: payment.amountCents, p_first_paid_at: payment.firstPaidAt,
    })
    if (error) throw error
    const decision = z.object({ state: z.string(), request: reviewSchema.nullable() }).parse(data)
    if (decision.state !== 'approved' || !decision.request) throw new SubscriptionCancellationChangedError()
    if (['processing', 'refund_pending', 'escalated'].includes(decision.request.status)) {
      await executeWithdrawal(db, gateway, decision.request)
    }
    const updated = await viewer.rpc('get_my_arena_subscription_withdrawal', { p_arena_id: arenaId })
    if (updated.error) throw updated.error
    request = summarySchema.nullable().parse(updated.data) ?? decision.request
    return unavailable()
  }

  // Missing or divergent evidence leaves the decision in review. A protocol
  // is recorded with the database clock without issuing any refund.
  const provider = checkout?.provider === 'asaas' || checkout?.provider === 'stripe'
    ? checkout.provider
    : subscription.gateway_checkout_id || process.env.PAYMENT_GATEWAY?.toLowerCase() === 'asaas' ? 'asaas' : 'stripe'
  const result = await db.rpc('request_arena_subscription_withdrawal', {
    p_arena_id: arenaId, p_actor_auth_id: actorAuthId, p_provider: provider,
  })
  if (result.error) throw result.error
  request = summarySchema.parse(result.data)
  return unavailable()
}

export async function listSubscriptionWithdrawalReviews(reviewerAuthId: string, requestId?: string) {
  const { data, error } = await getSupabaseAdmin().rpc('list_arena_subscription_withdrawals_for_review', {
    p_reviewer_auth_id: reviewerAuthId,
    ...(requestId && { p_request_id: requestId }),
  })
  if (error) {
    if (migrationMissing(error)) return null
    throw error
  }
  return z.array(reviewSchema).parse(data)
}

async function finishRefund(db: AdminDb, request: WithdrawalReview, paymentId: string, amountCents: number) {
  const { data, error } = await db.rpc('complete_arena_subscription_withdrawal', {
    p_request_id: request.id, p_gateway_payment_id: paymentId, p_amount_cents: amountCents,
  })
  if (error || data !== true) throw new Error('Falha ao conciliar a conclusão do estorno.')
}

async function flagForReconciliation(db: AdminDb, request: WithdrawalReview, code: string) {
  const { error } = await db.rpc('escalate_arena_subscription_withdrawal', { p_request_id: request.id, p_error_code: code })
  if (error) throw error
}

function verifiedScope(request: WithdrawalReview) {
  if (request.provider !== 'asaas' || !request.gateway_payment_id || !request.amount_cents
    || !request.gateway_subscription_id || !request.gateway_customer_id) {
    throw new PaymentApiError(409, 'O pedido ainda não tem cobrança Asaas validada.')
  }
  return {
    customerId: request.gateway_customer_id, subscriptionId: request.gateway_subscription_id,
    paymentId: request.gateway_payment_id, amountCents: request.amount_cents,
  }
}

export async function previewSubscriptionWithdrawal(request: WithdrawalReview, gateway = new AsaasWithdrawalGateway()) {
  if (request.provider !== 'asaas' || !request.gateway_subscription_id || !request.gateway_customer_id) {
    throw new PaymentApiError(409, 'A cobrança precisa de conferência operacional.')
  }
  const checkout = await verifiedCheckout(getSupabaseAdmin(), request.arena_id, request.gateway_subscription_id, request.gateway_customer_id)
  const payment = await gateway.findFirstPayment({
    customerId: request.gateway_customer_id, subscriptionId: request.gateway_subscription_id,
  }, checkout?.paid_at)
  return { ...payment, deadlineAt: proposedDeadline(checkout?.paid_at) }
}

async function executeWithdrawal(db: AdminDb, gateway: AsaasWithdrawalGateway, request: WithdrawalReview) {
  const scope = verifiedScope(request)
  let errorCode = 'withdrawal_provider_lookup_failed'
  try {
    let state = await gateway.getRefundState(scope)
    if (!request.renewal_stopped_at) {
      errorCode = 'withdrawal_stop_not_confirmed'
      const stopped = await gateway.stopSubscription(scope, async () => {
        const claim = await db.rpc('claim_arena_subscription_withdrawal_stop', { p_request_id: request.id })
        if (claim.error) throw claim.error
        return z.object({ delete_allowed: z.boolean() }).parse(claim.data).delete_allowed
      })
      // Another executor may hold the claim and still be finishing the DELETE.
      if (!stopped) return
      const stop = await db.rpc('record_arena_subscription_withdrawal_renewal_stopped', {
        p_request_id: request.id, p_gateway_subscription_id: scope.subscriptionId,
      })
      if (stop.error || stop.data !== true) throw new Error('Fim da recorrência não registrado.')
      state = await gateway.getRefundState(scope)
    }

    if (state === 'eligible' && !request.refund_requested_at) {
      errorCode = 'withdrawal_refund_result_unknown'
      const claim = await db.rpc('claim_arena_subscription_withdrawal_refund', { p_request_id: request.id })
      if (claim.error) throw claim.error
      if (z.object({ post_allowed: z.boolean() }).parse(claim.data).post_allowed !== true) return
      state = await gateway.submitFullRefund(scope)
    }
    if (state === 'completed') {
      errorCode = 'withdrawal_reconciliation_not_saved'
      await finishRefund(db, request, scope.paymentId, scope.amountCents)
    } else if (state === 'needs_reconciliation' || state === 'eligible') {
      await flagForReconciliation(db, request, 'withdrawal_refund_needs_reconciliation')
    }
  } catch {
    // A tentativa POST pode ter chegado ao Asaas. O registro gravado antes
    // dela permite que novas ações consultem o resultado sem reenviar dinheiro.
    await flagForReconciliation(db, request, errorCode)
  }
}

export async function actOnSubscriptionWithdrawal(input: {
  reviewerAuthId: string
  requestId: string
  action: 'approve' | 'reject' | 'resume'
  reason: string
  expectedPaymentId?: string
  expectedAmountCents?: number
}) {
  const db = getSupabaseAdmin()
  const [existing] = await listSubscriptionWithdrawalReviews(input.reviewerAuthId, input.requestId) ?? []
  if (!existing) throw new PaymentApiError(404, 'Pedido de desistência não encontrado.')
  if (input.action === 'resume') {
    if (!['processing', 'refund_pending', 'escalated'].includes(existing.status)) return
    await executeWithdrawal(db, new AsaasWithdrawalGateway(), existing)
    return
  }
  if (existing.status !== 'awaiting_review') return

  let payment: Awaited<ReturnType<typeof previewSubscriptionWithdrawal>> | undefined
  let gateway: AsaasWithdrawalGateway | undefined
  if (input.action === 'approve') {
    gateway = new AsaasWithdrawalGateway()
    payment = await previewSubscriptionWithdrawal(existing, gateway)
    if (payment.paymentId !== input.expectedPaymentId || payment.amountCents !== input.expectedAmountCents) {
      throw new PaymentApiError(409, 'A cobrança mudou desde a conferência. Abra o pedido novamente.')
    }
  }

  const { data, error } = await db.rpc('review_arena_subscription_withdrawal', {
    p_request_id: input.requestId, p_reviewer_auth_id: input.reviewerAuthId,
    p_decision: input.action, p_reason_code: input.reason,
    ...(payment && {
      p_gateway_customer_id: existing.gateway_customer_id ?? undefined,
      p_gateway_subscription_id: existing.gateway_subscription_id ?? undefined,
      p_gateway_payment_id: payment.paymentId,
      p_amount_cents: payment.amountCents,
      p_first_paid_at: payment.firstPaidAt,
    }),
  })
  if (error) throw error
  const request = reviewSchema.parse(data)
  if (gateway) await executeWithdrawal(db, gateway, request)
}

export async function reconcileSubscriptionWithdrawalFromAsaas(paymentId: string, subscriptionId: string | null) {
  const db = getSupabaseAdmin()
  const { data, error } = await db.rpc('find_arena_subscription_withdrawal_refund', { p_gateway_payment_id: paymentId })
  if (error && migrationMissing(error)) return null
  if (error) throw error
  const request = reviewSchema.nullable().parse(data)
  if (!request || (subscriptionId && subscriptionId !== request.gateway_subscription_id)) return null

  // Webhook apenas concilia. O estorno é solicitado após decisão registrada.
  if (request.status !== 'completed' && request.renewal_stopped_at) {
    const scope = verifiedScope(request)
    const state = await new AsaasWithdrawalGateway().getRefundState(scope)
    if (state === 'completed') await finishRefund(db, request, scope.paymentId, scope.amountCents)
    if (state === 'needs_reconciliation') {
      await flagForReconciliation(db, request, 'withdrawal_refund_needs_reconciliation')
    }
  }
  return request.arena_id
}
