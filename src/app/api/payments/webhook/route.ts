import { getSupabaseAdmin } from '@/lib/supabase-server'
import { observeHttpRequest } from '@/lib/observability/server'
import { logAuditEvent } from '@/modules/audit/audit-log.service'
import type {
  DomainSubscription,
  DomainWebhookEvent
} from '@/modules/payments/domain/types'
import {
  InvalidWebhookSignatureError,
  MissingWebhookSignatureError
} from '@/modules/payments/errors'
import { getPaymentGateway } from '@/modules/payments/gateway'
import { AsaasGateway } from '@/modules/payments/gateway/asaas.gateway'
import { EXPERIMENTAL_PLAN_KEY, planKeySchema } from '@/modules/payments/plans'
import {
  fetchPlanByGatewayPriceId,
  fetchPlanByKey,
} from '@/modules/payments/repositories/subscription-plans.repository'
import { planAccessEndIso } from '@/modules/payments/subscription-rules'
import { syncArenaBillingSnapshotFromGateway } from '@/modules/payments/usecases/sync-arena-billing-snapshot.usecase'
import type { Database, Json } from '@/types/supabase.types'
import { NextRequest, NextResponse } from 'next/server'

type ArenaSubscriptionTable = Database['public']['Tables']['arena_subscriptions']
type PaymentWebhookEventStatus = 'processing' | 'processed' | 'failed' | 'ignored'
type PaymentWebhookEventRow = Database['public']['Tables']['payment_webhook_events']['Row']

/** Evita gravar JSON/objeto serializado em `gateway_subscription_id` (bug CHECKOUT_PAID Asaas). */
function normalizeGatewaySubscriptionIdFromWebhook(
  id: string | null | undefined
): string | null {
  if (!id || typeof id !== 'string') return null
  const t = id.trim()
  if (!t || t.startsWith('{')) return null
  return t
}

function safeParseWebhookPayload(rawBody: string): Json | null {
  try {
    return JSON.parse(rawBody) as Json
  } catch {
    return null
  }
}

function payloadEventType(payload: Json | null, fallback: string) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const value = (payload as Record<string, Json | undefined>).event
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return fallback
}

function eventGatewaySubscriptionId(event: DomainWebhookEvent) {
  switch (event.kind) {
    case 'subscription.updated':
    case 'subscription.deleted':
      return event.subscription.id
    case 'invoice.paid':
    case 'invoice.payment_failed':
    case 'invoice.refunded':
    case 'invoice.chargeback':
    case 'invoice.action_required':
    case 'checkout.paid':
      return normalizeGatewaySubscriptionIdFromWebhook(event.subscriptionId)
    default:
      return null
  }
}

function eventGatewayCheckoutId(event: DomainWebhookEvent) {
  switch (event.kind) {
    case 'checkout.paid':
    case 'checkout.canceled':
    case 'checkout.expired':
      return event.checkoutId
    default:
      return null
  }
}

function isUniqueViolation(error: unknown) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
  )
}

function isProcessingStale(row: PaymentWebhookEventRow) {
  if (row.status !== 'processing') return false
  const startedAt = row.processing_started_at ?? row.updated_at
  const parsed = Date.parse(startedAt)
  if (Number.isNaN(parsed)) return true
  return Date.now() - parsed > 10 * 60 * 1000
}

async function beginWebhookProcessing(input: {
  provider: string
  event: DomainWebhookEvent
  rawBody: string
}): Promise<{ id: string; shouldProcess: boolean }> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const payload = safeParseWebhookPayload(input.rawBody)
  const eventType = payloadEventType(
    payload,
    input.event.kind === 'unhandled' ? input.event.eventType : input.event.kind
  )

  const basePayload = {
    provider: input.provider,
    provider_event_id: input.event.providerEventId,
    event_type: eventType,
    status: 'processing' as const,
    gateway_subscription_id: eventGatewaySubscriptionId(input.event),
    gateway_checkout_id: eventGatewayCheckoutId(input.event),
    payload,
    error_message: null,
    processing_started_at: now,
    updated_at: now,
  }

  const { data, error } = await supabase
    .from('payment_webhook_events')
    .insert(basePayload)
    .select('id')
    .single()

  if (!error && data) {
    return { id: data.id, shouldProcess: true }
  }

  if (!isUniqueViolation(error)) {
    throw error
  }

  const { data: existing, error: selectError } = await supabase
    .from('payment_webhook_events')
    .select('*')
    .eq('provider', input.provider)
    .eq('provider_event_id', input.event.providerEventId)
    .single()

  if (selectError) throw selectError

  if (
    existing.status === 'processed' ||
    existing.status === 'ignored' ||
    (existing.status === 'processing' && !isProcessingStale(existing))
  ) {
    return { id: existing.id, shouldProcess: false }
  }

  const { error: updateError } = await supabase
    .from('payment_webhook_events')
    .update({
      ...basePayload,
      attempts: existing.attempts + 1,
      processed_at: null,
      updated_at: now,
    })
    .eq('id', existing.id)

  if (updateError) throw updateError

  return { id: existing.id, shouldProcess: true }
}

async function finishWebhookProcessing(input: {
  id: string
  status: Extract<PaymentWebhookEventStatus, 'processed' | 'ignored'>
  arenaId?: string | null
  event?: DomainWebhookEvent
}) {
  const now = new Date().toISOString()
  const { error } = await getSupabaseAdmin()
    .from('payment_webhook_events')
    .update({
      status: input.status,
      arena_id: input.arenaId ?? null,
      gateway_subscription_id: input.event
        ? eventGatewaySubscriptionId(input.event)
        : undefined,
      gateway_checkout_id: input.event ? eventGatewayCheckoutId(input.event) : undefined,
      error_message: null,
      processed_at: now,
      updated_at: now,
    })
    .eq('id', input.id)

  if (error) {
    throw error
  }
}

async function failWebhookProcessing(input: {
  id: string
  event: DomainWebhookEvent
  error: unknown
}) {
  const message =
    input.error instanceof Error ? input.error.message : String(input.error)
  const now = new Date().toISOString()
  try {
    const { error } = await getSupabaseAdmin()
      .from('payment_webhook_events')
      .update({
        status: 'failed',
        gateway_subscription_id: eventGatewaySubscriptionId(input.event),
        gateway_checkout_id: eventGatewayCheckoutId(input.event),
        error_message: message.slice(0, 2000),
        updated_at: now,
      })
      .eq('id', input.id)

    return error
  } catch (error) {
    return error
  }
}

export async function POST(request: NextRequest) {
  const observation = observeHttpRequest(request, {
    component: 'payments',
    operation: 'webhook'
  })
  const gateway = getPaymentGateway()
  const signature = request.headers.get(gateway.webhookSignatureHeader)

  if (!signature) {
    return observation.respond(new MissingWebhookSignatureError().toNextResponse())
  }

  const rawBody = await request.text()
  let event: DomainWebhookEvent

  try {
    event = await gateway.verifyAndParseWebhook(rawBody, signature)
  } catch (error) {
    observation.log('warn', 'payments.webhook.signature_rejected', { error })
    return observation.respond(new InvalidWebhookSignatureError().toNextResponse())
  }

  let webhookEvent: { id: string; shouldProcess: boolean }
  try {
    webhookEvent = await beginWebhookProcessing({
      provider: gateway.providerName,
      event,
      rawBody,
    })
  } catch (error) {
    observation.log('error', 'payments.webhook.registration_failed', { error })
    return observation.respond(NextResponse.json({ error: 'Webhook registration failed' }, { status: 500 }))
  }

  if (!webhookEvent.shouldProcess) {
    return observation.respond(NextResponse.json({ received: true, duplicate: true }))
  }

  try {
    let arenaId: string | null = null
    let finalStatus: Extract<PaymentWebhookEventStatus, 'processed' | 'ignored'> = 'processed'

    switch (event.kind) {
      case 'subscription.updated':
        arenaId = await handleSubscriptionUpdated(event.subscription, event.providerEventId)
        break

      case 'subscription.deleted':
        arenaId = await handleSubscriptionDeleted(event.subscription, event.providerEventId)
        break

      case 'invoice.paid':
        arenaId = await handleInvoicePaid(event.subscriptionId, event.invoice.id, event.providerEventId)
        break

      case 'invoice.payment_failed':
        arenaId = await handleInvoicePaymentFailed(
          event.subscriptionId,
          event.invoice.id,
          event.invoice.attemptCount,
          event.providerEventId
        )
        break

      case 'invoice.refunded':
        arenaId = await handleInvoiceRefunded(
          event.subscriptionId,
          event.invoice.id,
          event.providerEventId
        )
        break

      case 'invoice.chargeback':
        arenaId = await handleInvoiceChargeback(
          event.subscriptionId,
          event.invoice.id,
          event.providerEventId
        )
        break

      case 'invoice.action_required':
        arenaId = await handleInvoiceActionRequired(
          event.subscriptionId,
          event.invoice.id,
          event.providerEventId
        )
        break

      case 'checkout.paid':
        arenaId = await handleCheckoutPaid(
          event.checkoutId,
          event.subscriptionId,
          event.customerId,
          event.providerEventId
        )
        break

      case 'checkout.canceled':
        arenaId = await handleCheckoutClosed(
          event.checkoutId,
          'canceled',
          event.providerEventId
        )
        break

      case 'checkout.expired':
        arenaId = await handleCheckoutClosed(
          event.checkoutId,
          'expired',
          event.providerEventId
        )
        break

      default:
        finalStatus = 'ignored'
        break
    }

    await finishWebhookProcessing({
      id: webhookEvent.id,
      status: finalStatus,
      arenaId,
      event,
    })
  } catch (error) {
    const persistenceError = await failWebhookProcessing({ id: webhookEvent.id, event, error })
    if (persistenceError) {
      observation.log('error', 'payments.webhook.failure_persistence_failed', {
        error: persistenceError,
      })
    }
    observation.log('error', 'payments.webhook.processing_failed', { event_kind: event.kind, error })
    return observation.respond(NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 }))
  }

  return observation.respond(NextResponse.json({ received: true }))
}

async function resolveArenaIdBySubscriptionId(subscriptionId: string) {
  const { data } = await getSupabaseAdmin()
    .from('arena_subscriptions')
    .select('arena_id')
    .eq('gateway_subscription_id', subscriptionId)
    .maybeSingle()

  return data?.arena_id ?? null
}

async function updateArenaSubscriptionRecord(input: {
  arenaId: string | null
  subscriptionId: string
  payload: ArenaSubscriptionTable['Update']
}) {
  const supabase = getSupabaseAdmin()

  if (input.arenaId) {
    const { data, error } = await supabase
      .from('arena_subscriptions')
      .update(input.payload)
      .eq('arena_id', input.arenaId)
      .select('arena_id')
      .maybeSingle()

    if (error) throw error
    if (data?.arena_id) return data.arena_id
  }

  const { data, error } = await supabase
    .from('arena_subscriptions')
    .update(input.payload)
    .eq('gateway_subscription_id', input.subscriptionId)
    .select('arena_id')
    .maybeSingle()

  if (error) throw error

  if (data?.arena_id) return data.arena_id

  console.warn('[payments-webhook] Subscription record not found for event', {
    arena_id: input.arenaId,
    gateway_subscription_id: input.subscriptionId
  })
  return null
}

async function resolveSubscriptionPlan(subscription: DomainSubscription) {
  const priceId = subscription.primaryItem?.priceId ?? null
  const matchedPlan = priceId ? await fetchPlanByGatewayPriceId(priceId) : null
  return { matchedPlan }
}

async function handleSubscriptionUpdated(
  subscription: DomainSubscription,
  eventId: string
): Promise<string | null> {
  const { matchedPlan } = await resolveSubscriptionPlan(subscription)
  const arenaId =
    subscription.metadata?.arena_id ??
    (await resolveArenaIdBySubscriptionId(subscription.id))

  const payload = {
    gateway_subscription_id: subscription.id,
    gateway_customer_id: subscription.customerId,
    status: subscription.status,
    current_period_end: subscription.primaryItem?.currentPeriodEndIso ?? null,
    cancel_at_period_end: subscription.cancelAtPeriodEnd,
    canceled_at: subscription.status === 'active' ? null : subscription.canceledAtIso,
    updated_at: new Date().toISOString(),
    ...(matchedPlan ? { plan_key: matchedPlan.key, plan_id: matchedPlan.id } : {})
  }

  const resolvedArenaId = await updateArenaSubscriptionRecord({
    arenaId,
    subscriptionId: subscription.id,
    payload
  })

  console.info('[payments-webhook] Subscription updated', {
    subscription_id: subscription.id,
    status: subscription.status,
    arena_id: resolvedArenaId ?? '(no metadata)'
  })

  await logAuditEvent({
    entityType: 'arena_subscription',
    entityId: resolvedArenaId ?? subscription.id,
    action: 'subscription.updated',
    actorId: eventId,
    actorType: 'payment_webhook',
    newValue: {
      status: subscription.status,
      cancel_at_period_end: subscription.cancelAtPeriodEnd,
      plan_key: matchedPlan?.key ?? null
    },
    metadata: { provider_event_id: eventId, gateway_subscription_id: subscription.id }
  })

  if (resolvedArenaId) {
    await syncArenaBillingSnapshotFromGateway(resolvedArenaId)
  }

  return resolvedArenaId
}

async function handleSubscriptionDeleted(
  subscription: DomainSubscription,
  eventId: string
): Promise<string | null> {
  const supabase = getSupabaseAdmin()
  const arenaId =
    subscription.metadata?.arena_id ??
    (await resolveArenaIdBySubscriptionId(subscription.id))

  const canceledAt = subscription.canceledAtIso ?? new Date().toISOString()

  const payload = {
    gateway_subscription_id: subscription.id,
    status: 'canceled' as const,
    cancel_at_period_end: false,
    canceled_at: canceledAt,
    updated_at: new Date().toISOString()
  }

  const query = supabase.from('arena_subscriptions').update(payload)
  const { error } = arenaId
    ? await query.eq('arena_id', arenaId)
    : await query.eq('gateway_subscription_id', subscription.id)

  if (error) {
    console.error('[payments-webhook] handleSubscriptionDeleted — update failed', error)
    throw error
  }

  console.info('[payments-webhook] Subscription deleted — access revoked', {
    subscription_id: subscription.id,
    arena_id: arenaId ?? '(no metadata)'
  })

  await logAuditEvent({
    entityType: 'arena_subscription',
    entityId: arenaId ?? subscription.id,
    action: 'subscription.deleted',
    actorId: eventId,
    actorType: 'payment_webhook',
    newValue: { status: 'canceled', canceled_at: canceledAt },
    metadata: { provider_event_id: eventId, gateway_subscription_id: subscription.id }
  })

  return arenaId
}

async function handleInvoicePaid(
  subscriptionId: string | null,
  invoiceId: string,
  eventId: string
): Promise<string | null> {
  if (!subscriptionId) return null

  const subscription = await getPaymentGateway().retrieveSubscription(subscriptionId)
  if (!subscription) return null

  const arenaId =
    subscription.metadata?.arena_id ??
    (await resolveArenaIdBySubscriptionId(subscriptionId))
  const { matchedPlan } = await resolveSubscriptionPlan(subscription)

  const payload = {
    gateway_subscription_id: subscriptionId,
    gateway_customer_id: subscription.customerId,
    status: 'active' as const,
    current_period_end: subscription.primaryItem?.currentPeriodEndIso ?? null,
    cancel_at_period_end: subscription.cancelAtPeriodEnd,
    canceled_at: null,
    updated_at: new Date().toISOString(),
    ...(matchedPlan ? { plan_key: matchedPlan.key, plan_id: matchedPlan.id } : {})
  }

  const resolvedArenaId = await updateArenaSubscriptionRecord({
    arenaId,
    subscriptionId,
    payload
  })

  console.info('[payments-webhook] Invoice paid — access renewed', {
    subscription_id: subscriptionId,
    period_end: subscription.primaryItem?.currentPeriodEndIso ?? null,
    arena_id: resolvedArenaId ?? '(no metadata)'
  })

  if (resolvedArenaId) {
    await syncArenaBillingSnapshotFromGateway(resolvedArenaId)
  }

  await logAuditEvent({
    entityType: 'arena_subscription',
    entityId: resolvedArenaId ?? subscriptionId,
    action: 'invoice.paid',
    actorId: eventId,
    actorType: 'payment_webhook',
    newValue: {
      status: 'active',
      current_period_end: subscription.primaryItem?.currentPeriodEndIso ?? null,
      plan_key: matchedPlan?.key ?? null
    },
    metadata: {
      provider_event_id: eventId,
      gateway_subscription_id: subscriptionId,
      invoice_id: invoiceId
    }
  })

  return resolvedArenaId
}

async function handleInvoicePaymentFailed(
  subscriptionId: string | null,
  invoiceId: string,
  attemptCount: number,
  eventId: string
): Promise<string | null> {
  if (!subscriptionId) return null

  const supabase = getSupabaseAdmin()
  const arenaId = await resolveArenaIdBySubscriptionId(subscriptionId)

  const updateQuery = supabase
    .from('arena_subscriptions')
    .update({ status: 'past_due', updated_at: new Date().toISOString() })

  const { error } = arenaId
    ? await updateQuery.eq('arena_id', arenaId)
    : await updateQuery.eq('gateway_subscription_id', subscriptionId)

  if (error) {
    console.error('[payments-webhook] handleInvoicePaymentFailed — update failed', error)
    throw error
  }

  console.warn('[payments-webhook] Invoice payment failed', {
    subscription_id: subscriptionId,
    attempt_count: attemptCount
  })

  await logAuditEvent({
    entityType: 'arena_subscription',
    entityId: arenaId ?? subscriptionId,
    action: 'invoice.payment_failed',
    actorId: eventId,
    actorType: 'payment_webhook',
    newValue: { status: 'past_due' },
    metadata: {
      provider_event_id: eventId,
      gateway_subscription_id: subscriptionId,
      invoice_id: invoiceId,
      attempt_count: attemptCount
    }
  })

  return arenaId
}

async function handleCheckoutPaid(
  checkoutId: string,
  subscriptionId: string | null,
  customerId: string | null,
  eventId: string
): Promise<string | null> {
  if (!checkoutId) return null

  const supabase = getSupabaseAdmin()

  const { data: attempt } = await supabase
    .from('payment_checkout_attempts')
    .select('arena_id, plan_id, plan_key, gateway_customer_id, replaces_gateway_subscription_id')
    .eq('provider', 'asaas')
    .eq('checkout_id', checkoutId)
    .maybeSingle()

  const { data: subscriptionRecord } = attempt
    ? await supabase
        .from('arena_subscriptions')
        .select('arena_id, plan_id, plan_key, gateway_customer_id, gateway_subscription_id')
        .eq('arena_id', attempt.arena_id)
        .maybeSingle()
    : await supabase
        .from('arena_subscriptions')
        .select('arena_id, plan_id, plan_key, gateway_customer_id, gateway_subscription_id')
        .eq('gateway_checkout_id', checkoutId)
        .maybeSingle()

  const record = subscriptionRecord
    ? {
        ...subscriptionRecord,
        plan_id: attempt?.plan_id ?? subscriptionRecord.plan_id,
        plan_key: attempt?.plan_key ?? subscriptionRecord.plan_key,
        gateway_customer_id:
          attempt?.gateway_customer_id ?? subscriptionRecord.gateway_customer_id,
      }
    : null

  if (!record) {
    console.warn('[payments-webhook] CHECKOUT_PAID — checkout não encontrado no banco', {
      checkout_id: checkoutId,
      subscription_id: subscriptionId,
    })
    return null
  }

  let resolvedSubscriptionId = normalizeGatewaySubscriptionIdFromWebhook(subscriptionId)

  const effectiveCustomerId = customerId ?? record.gateway_customer_id
  const gateway = getPaymentGateway()
  if (
    !resolvedSubscriptionId &&
    effectiveCustomerId &&
    gateway.findSubscriptionIdAfterCheckoutPaid
  ) {
    resolvedSubscriptionId = await gateway.findSubscriptionIdAfterCheckoutPaid({
      customerId: effectiveCustomerId,
      arenaId: record.arena_id,
    })
  }

  const fullSubscription = resolvedSubscriptionId
    ? await gateway.retrieveSubscriptionWithPaymentMethod(resolvedSubscriptionId)
    : null

  const isExperimentalPlan = record.plan_key === EXPERIMENTAL_PLAN_KEY
  const activatedAt = new Date()
  const payload: ArenaSubscriptionTable['Update'] & {
    experimental_started_at?: string
  } = {
    status: 'active',
    gateway_subscription_id: resolvedSubscriptionId ?? null,
    ...(effectiveCustomerId ? { gateway_customer_id: effectiveCustomerId } : {}),
    current_period_end:
      isExperimentalPlan
        ? planAccessEndIso(EXPERIMENTAL_PLAN_KEY, activatedAt)
        : fullSubscription?.primaryItem?.currentPeriodEndIso ?? null,
    cancel_at_period_end: false,
    canceled_at: null,
    ...(isExperimentalPlan
      ? { experimental_started_at: activatedAt.toISOString() }
      : {}),
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('arena_subscriptions')
    .update(payload)
    .eq('arena_id', record.arena_id)

  if (error) {
    console.error('[payments-webhook] handleCheckoutPaid — update failed', error)
    throw error
  }

  await supabase
    .from('payment_checkout_attempts')
    .update({
      status: 'paid',
      result_gateway_subscription_id: resolvedSubscriptionId,
      paid_at: activatedAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('provider', 'asaas')
    .eq('checkout_id', checkoutId)

  await syncArenaBillingSnapshotFromGateway(record.arena_id)

  const replacedSubscriptionId =
    attempt?.replaces_gateway_subscription_id ??
    (record.gateway_subscription_id &&
    record.gateway_subscription_id !== resolvedSubscriptionId
      ? record.gateway_subscription_id
      : null)

  if (
    replacedSubscriptionId &&
    resolvedSubscriptionId &&
    replacedSubscriptionId !== resolvedSubscriptionId
  ) {
    try {
      await gateway.cancelSubscriptionImmediately(replacedSubscriptionId)
      await logAuditEvent({
        entityType: 'arena_subscription',
        entityId: record.arena_id,
        action: 'subscription.replaced_subscription_canceled',
        actorId: eventId,
        actorType: 'payment_webhook',
        newValue: {
          canceled_gateway_subscription_id: replacedSubscriptionId,
          replacement_gateway_subscription_id: resolvedSubscriptionId,
        },
        metadata: {
          provider_event_id: eventId,
          gateway_checkout_id: checkoutId,
        },
      })
    } catch (err) {
      console.error(
        '[payments-webhook] CHECKOUT_PAID — falha ao cancelar assinatura substituída',
        {
          old_subscription_id: replacedSubscriptionId,
          new_subscription_id: resolvedSubscriptionId,
          err,
        }
      )
      throw err
    }
  }

  if (resolvedSubscriptionId && gateway instanceof AsaasGateway) {
    const parsedKey = planKeySchema.safeParse(record.plan_key)
    const plan =
      parsedKey.success ? await fetchPlanByKey(parsedKey.data) : null
    const description = plan?.label
      ? `Arena Digital — ${plan.label}`
      : `Arena Digital — ${record.plan_key}`
    try {
      await gateway.setSubscriptionDescription(
        resolvedSubscriptionId,
        description
      )
    } catch (err) {
      console.warn(
        '[payments-webhook] CHECKOUT_PAID — falha ao definir description da assinatura no Asaas',
        { subscription_id: resolvedSubscriptionId, err }
      )
    }
  }

  console.info('[payments-webhook] Checkout paid — subscription ativada', {
    checkout_id: checkoutId,
    subscription_id: resolvedSubscriptionId,
    arena_id: record.arena_id,
  })

  await logAuditEvent({
    entityType: 'arena_subscription',
    entityId: record.arena_id,
    action: 'subscription.activated',
    actorId: eventId,
    actorType: 'payment_webhook',
    newValue: {
      status: 'active',
      gateway_subscription_id: resolvedSubscriptionId,
      plan_key: record.plan_key,
      plan_id: record.plan_id,
    },
    metadata: {
      provider_event_id: eventId,
      gateway_checkout_id: checkoutId,
    },
  })

  return record.arena_id
}

async function handleCheckoutClosed(
  checkoutId: string,
  status: 'canceled' | 'expired',
  eventId: string
): Promise<string | null> {
  if (!checkoutId) return null

  const supabase = getSupabaseAdmin()
  const { data: attempt, error } = await supabase
    .from('payment_checkout_attempts')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('provider', 'asaas')
    .eq('checkout_id', checkoutId)
    .select('arena_id, plan_key, plan_id')
    .maybeSingle()

  if (error) throw error

  if (!attempt) {
    console.warn('[payments-webhook] CHECKOUT closed — tentativa não encontrada', {
      checkout_id: checkoutId,
      status,
    })
    return null
  }

  await logAuditEvent({
    entityType: 'arena_subscription',
    entityId: attempt.arena_id,
    action: status === 'canceled' ? 'checkout.canceled' : 'checkout.expired',
    actorId: eventId,
    actorType: 'payment_webhook',
    newValue: {
      checkout_status: status,
      plan_key: attempt.plan_key,
      plan_id: attempt.plan_id,
    },
    metadata: {
      provider_event_id: eventId,
      gateway_checkout_id: checkoutId,
    },
  })

  return attempt.arena_id
}

async function handleInvoiceActionRequired(
  subscriptionId: string | null,
  invoiceId: string,
  eventId: string
): Promise<string | null> {
  if (!subscriptionId) return null

  const supabase = getSupabaseAdmin()
  const arenaId = await resolveArenaIdBySubscriptionId(subscriptionId)

  const updateQuery = supabase
    .from('arena_subscriptions')
    .update({ status: 'incomplete', updated_at: new Date().toISOString() })

  const { error } = arenaId
    ? await updateQuery.eq('arena_id', arenaId)
    : await updateQuery.eq('gateway_subscription_id', subscriptionId)

  if (error) {
    console.error('[payments-webhook] handleInvoiceActionRequired — update failed', error)
    throw error
  }

  console.warn('[payments-webhook] Invoice requires action (3DS)', {
    subscription_id: subscriptionId,
    invoice_id: invoiceId
  })

  await logAuditEvent({
    entityType: 'arena_subscription',
    entityId: arenaId ?? subscriptionId,
    action: 'invoice.action_required',
    actorId: eventId,
    actorType: 'payment_webhook',
    newValue: { status: 'incomplete' },
    metadata: {
      provider_event_id: eventId,
      gateway_subscription_id: subscriptionId,
      invoice_id: invoiceId
    }
  })

  return arenaId
}

async function handleInvoiceRefunded(
  subscriptionId: string | null,
  invoiceId: string,
  eventId: string
): Promise<string | null> {
  if (!subscriptionId) return null

  const supabase = getSupabaseAdmin()
  const arenaId = await resolveArenaIdBySubscriptionId(subscriptionId)

  const updateQuery = supabase
    .from('arena_subscriptions')
    .update({ status: 'past_due', updated_at: new Date().toISOString() })

  const { error } = arenaId
    ? await updateQuery.eq('arena_id', arenaId)
    : await updateQuery.eq('gateway_subscription_id', subscriptionId)

  if (error) {
    console.error('[payments-webhook] handleInvoiceRefunded — update failed', error)
    throw error
  }

  console.warn('[payments-webhook] Invoice refunded', {
    subscription_id: subscriptionId,
    invoice_id: invoiceId,
  })

  await logAuditEvent({
    entityType: 'arena_subscription',
    entityId: arenaId ?? subscriptionId,
    action: 'invoice.refunded',
    actorId: eventId,
    actorType: 'payment_webhook',
    newValue: { status: 'past_due' },
    metadata: {
      provider_event_id: eventId,
      gateway_subscription_id: subscriptionId,
      invoice_id: invoiceId,
    },
  })

  return arenaId
}

async function handleInvoiceChargeback(
  subscriptionId: string | null,
  invoiceId: string,
  eventId: string
): Promise<string | null> {
  if (!subscriptionId) return null

  const supabase = getSupabaseAdmin()
  const arenaId = await resolveArenaIdBySubscriptionId(subscriptionId)

  const updateQuery = supabase
    .from('arena_subscriptions')
    .update({ status: 'unpaid', updated_at: new Date().toISOString() })

  const { error } = arenaId
    ? await updateQuery.eq('arena_id', arenaId)
    : await updateQuery.eq('gateway_subscription_id', subscriptionId)

  if (error) {
    console.error('[payments-webhook] handleInvoiceChargeback — update failed', error)
    throw error
  }

  console.warn('[payments-webhook] Invoice chargeback', {
    subscription_id: subscriptionId,
    invoice_id: invoiceId,
  })

  await logAuditEvent({
    entityType: 'arena_subscription',
    entityId: arenaId ?? subscriptionId,
    action: 'invoice.chargeback',
    actorId: eventId,
    actorType: 'payment_webhook',
    newValue: { status: 'unpaid' },
    metadata: {
      provider_event_id: eventId,
      gateway_subscription_id: subscriptionId,
      invoice_id: invoiceId,
    },
  })

  return arenaId
}
