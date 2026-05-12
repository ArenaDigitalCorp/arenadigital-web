import { getSupabaseAdmin } from '@/lib/supabase-server'
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
import { planKeySchema } from '@/modules/payments/plans'
import {
  fetchPlanByGatewayPriceId,
  fetchPlanByKey,
} from '@/modules/payments/repositories/subscription-plans.repository'
import { syncArenaBillingSnapshotFromGateway } from '@/modules/payments/usecases/sync-arena-billing-snapshot.usecase'
import type { Database } from '@/types/supabase.types'
import { NextRequest, NextResponse } from 'next/server'

type ArenaSubscriptionTable = Database['public']['Tables']['arena_subscriptions']

/** Evita gravar JSON/objeto serializado em `gateway_subscription_id` (bug CHECKOUT_PAID Asaas). */
function normalizeGatewaySubscriptionIdFromWebhook(
  id: string | null | undefined
): string | null {
  if (!id || typeof id !== 'string') return null
  const t = id.trim()
  if (!t || t.startsWith('{')) return null
  return t
}

export async function POST(request: NextRequest) {
  const gateway = getPaymentGateway()
  const signature = request.headers.get(gateway.webhookSignatureHeader)

  if (!signature) {
    return new MissingWebhookSignatureError().toNextResponse()
  }

  const rawBody = await request.text()
  let event: DomainWebhookEvent

  try {
    event = await gateway.verifyAndParseWebhook(rawBody, signature)
  } catch (error) {
    console.error('[payments-webhook] Failed to verify webhook', error)
    return new InvalidWebhookSignatureError().toNextResponse()
  }

  try {
    switch (event.kind) {
      case 'subscription.updated':
        await handleSubscriptionUpdated(event.subscription, event.providerEventId)
        break

      case 'subscription.deleted':
        await handleSubscriptionDeleted(event.subscription, event.providerEventId)
        break

      case 'invoice.paid':
        await handleInvoicePaid(event.subscriptionId, event.invoice.id, event.providerEventId)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(
          event.subscriptionId,
          event.invoice.id,
          event.invoice.attemptCount,
          event.providerEventId
        )
        break

      case 'invoice.action_required':
        await handleInvoiceActionRequired(
          event.subscriptionId,
          event.invoice.id,
          event.providerEventId
        )
        break

      case 'checkout.paid':
        await handleCheckoutPaid(
          event.checkoutId,
          event.subscriptionId,
          event.customerId,
          event.providerEventId
        )
        break

      default:
        break
    }
  } catch (error) {
    console.error('[payments-webhook] Error processing event', { kind: event.kind, error })
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
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
) {
  const { matchedPlan } = await resolveSubscriptionPlan(subscription)
  const arenaId =
    subscription.metadata?.arena_id ??
    (await resolveArenaIdBySubscriptionId(subscription.id))

  const payload = {
    gateway_subscription_id: subscription.id,
    gateway_customer_id: subscription.customerId,
    status: subscription.status,
    current_period_end: subscription.primaryItem?.currentPeriodEndIso ?? null,
    cancel_at_period_end:
      subscription.status === 'active' ? false : subscription.cancelAtPeriodEnd,
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
}

async function handleSubscriptionDeleted(
  subscription: DomainSubscription,
  eventId: string
) {
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
}

async function handleInvoicePaid(
  subscriptionId: string | null,
  invoiceId: string,
  eventId: string
) {
  if (!subscriptionId) return

  const subscription = await getPaymentGateway().retrieveSubscription(subscriptionId)
  if (!subscription) return

  const arenaId =
    subscription.metadata?.arena_id ??
    (await resolveArenaIdBySubscriptionId(subscriptionId))
  const { matchedPlan } = await resolveSubscriptionPlan(subscription)

  const payload = {
    gateway_subscription_id: subscriptionId,
    gateway_customer_id: subscription.customerId,
    status: 'active' as const,
    current_period_end: subscription.primaryItem?.currentPeriodEndIso ?? null,
    cancel_at_period_end: false,
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
}

async function handleInvoicePaymentFailed(
  subscriptionId: string | null,
  invoiceId: string,
  attemptCount: number,
  eventId: string
) {
  if (!subscriptionId) return

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
}

async function handleCheckoutPaid(
  checkoutId: string,
  subscriptionId: string | null,
  customerId: string | null,
  eventId: string
) {
  if (!checkoutId) return

  const supabase = getSupabaseAdmin()

  const { data: record } = await supabase
    .from('arena_subscriptions')
    .select('arena_id, plan_id, plan_key, gateway_customer_id')
    .eq('gateway_checkout_id', checkoutId)
    .maybeSingle()

  if (!record) {
    console.warn('[payments-webhook] CHECKOUT_PAID — checkout não encontrado no banco', {
      checkout_id: checkoutId,
      subscription_id: subscriptionId,
    })
    return
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

  const payload: ArenaSubscriptionTable['Update'] = {
    status: 'active',
    gateway_subscription_id: resolvedSubscriptionId ?? null,
    ...(effectiveCustomerId ? { gateway_customer_id: effectiveCustomerId } : {}),
    current_period_end:
      fullSubscription?.primaryItem?.currentPeriodEndIso ?? null,
    cancel_at_period_end: false,
    canceled_at: null,
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

  await syncArenaBillingSnapshotFromGateway(record.arena_id)

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
}

async function handleInvoiceActionRequired(
  subscriptionId: string | null,
  invoiceId: string,
  eventId: string
) {
  if (!subscriptionId) return

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
}
