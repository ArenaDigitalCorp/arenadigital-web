import { stripe } from '@/lib/stripe.client'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import {
  InvalidStripeWebhookSignatureError,
  MissingStripeSignatureError
} from '@/modules/stripe/errors'
import { fetchPlanByStripePrice } from '@/modules/stripe/repositories/subscription-plans.repository'
import { logAuditEvent } from '@/modules/audit/audit-log.service'
import type { Database } from '@/types/supabase.types'
import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'

type ArenaSubscriptionTable = Database['public']['Tables']['arena_subscriptions']

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return new MissingStripeSignatureError().toNextResponse()
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[stripe-webhook] Missing STRIPE_WEBHOOK_SECRET')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const rawBody = await request.text()
  let event: Stripe.Event

  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret)
  } catch {
    return new InvalidStripeWebhookSignatureError().toNextResponse()
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, event.id)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, event.id)
        break

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice, event.id)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, event.id)
        break

      case 'invoice.payment_action_required':
        await handleInvoiceActionRequired(event.data.object as Stripe.Invoice, event.id)
        break

      default:
        break
    }
  } catch (error) {
    console.error('[stripe-webhook] Error processing event', { type: event.type, error })
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

function getCustomerId(subscription: Stripe.Subscription): string {
  return typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id
}

async function resolveArenaIdBySubscriptionId(subscriptionId: string) {
  const { data } = await getSupabaseAdmin()
    .from('arena_subscriptions')
    .select('arena_id')
    .eq('stripe_subscription_id', subscriptionId)
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
    const { error } = await supabase
      .from('arena_subscriptions')
      .upsert(
        { arena_id: input.arenaId, ...input.payload } as ArenaSubscriptionTable['Insert'],
        { onConflict: 'arena_id' }
      )

    if (error) {
      throw error
    }

    return input.arenaId
  }

  const { error } = await supabase
    .from('arena_subscriptions')
    .update(input.payload)
    .eq('stripe_subscription_id', input.subscriptionId)

  if (error) {
    throw error
  }

  return resolveArenaIdBySubscriptionId(input.subscriptionId)
}

async function resolveSubscriptionFields(subscription: Stripe.Subscription) {
  const rawPeriodEnd = subscription.items.data[0]?.current_period_end
  const periodEnd = rawPeriodEnd
    ? new Date(rawPeriodEnd * 1000).toISOString()
    : null

  const canceledAt = subscription.canceled_at
    ? new Date(subscription.canceled_at * 1000).toISOString()
    : null

  const stripePriceId = subscription.items?.data?.[0]?.price?.id ?? null
  const matchedPlan = stripePriceId
    ? await fetchPlanByStripePrice(stripePriceId)
    : null

  return { periodEnd, canceledAt, matchedPlan }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription, eventId: string) {
  const { periodEnd, canceledAt, matchedPlan } = await resolveSubscriptionFields(subscription)
  const arenaId = subscription.metadata?.arena_id ?? (await resolveArenaIdBySubscriptionId(subscription.id))

  const payload = {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: getCustomerId(subscription),
    status: subscription.status,
    current_period_end: periodEnd,
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: canceledAt,
    updated_at: new Date().toISOString(),
    ...(matchedPlan ? { plan_key: matchedPlan.key, plan_id: matchedPlan.id } : {})
  }

  const resolvedArenaId = await updateArenaSubscriptionRecord({
    arenaId,
    subscriptionId: subscription.id,
    payload
  })

  console.info('[stripe-webhook] Subscription updated', {
    subscription_id: subscription.id,
    status: subscription.status,
    arena_id: resolvedArenaId ?? '(no metadata)'
  })

  await logAuditEvent({
    entityType: 'arena_subscription',
    entityId: resolvedArenaId ?? subscription.id,
    action: 'subscription.updated',
    actorId: eventId,
    actorType: 'stripe_webhook',
    newValue: {
      status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end,
      plan_key: matchedPlan?.key ?? null
    },
    metadata: { stripe_event_id: eventId, stripe_subscription_id: subscription.id }
  })
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, eventId: string) {
  const supabase = getSupabaseAdmin()
  const arenaId = subscription.metadata?.arena_id ?? (await resolveArenaIdBySubscriptionId(subscription.id))

  const canceledAt = subscription.canceled_at
    ? new Date(subscription.canceled_at * 1000).toISOString()
    : new Date().toISOString()

  const payload = {
    stripe_subscription_id: subscription.id,
    status: 'canceled' as const,
    cancel_at_period_end: false,
    canceled_at: canceledAt,
    updated_at: new Date().toISOString()
  }

  if (arenaId) {
    const { error } = await supabase
      .from('arena_subscriptions')
      .update(payload)
      .eq('arena_id', arenaId)

    if (error) {
      console.error('[stripe-webhook] handleSubscriptionDeleted — update failed', error)
      throw error
    }
  } else {
    const { error } = await supabase
      .from('arena_subscriptions')
      .update(payload)
      .eq('stripe_subscription_id', subscription.id)

    if (error) {
      console.error('[stripe-webhook] handleSubscriptionDeleted — update failed', error)
      throw error
    }
  }

  console.info('[stripe-webhook] Subscription deleted — access revoked', {
    subscription_id: subscription.id,
    arena_id: arenaId ?? '(no metadata)'
  })

  await logAuditEvent({
    entityType: 'arena_subscription',
    entityId: arenaId ?? subscription.id,
    action: 'subscription.deleted',
    actorId: eventId,
    actorType: 'stripe_webhook',
    newValue: { status: 'canceled', canceled_at: canceledAt },
    metadata: { stripe_event_id: eventId, stripe_subscription_id: subscription.id }
  })
}

async function handleInvoicePaid(invoice: Stripe.Invoice, eventId: string) {
  const subscriptionRef = invoice.parent?.subscription_details?.subscription
  const subscriptionId =
    typeof subscriptionRef === 'string'
      ? subscriptionRef
      : subscriptionRef?.id

  if (!subscriptionId) return

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const arenaId = subscription.metadata?.arena_id ?? (await resolveArenaIdBySubscriptionId(subscriptionId))
  const { periodEnd, canceledAt, matchedPlan } = await resolveSubscriptionFields(subscription)

  const payload = {
    stripe_subscription_id: subscriptionId,
    stripe_customer_id: getCustomerId(subscription),
    status: 'active' as const,
    current_period_end: periodEnd,
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: canceledAt,
    updated_at: new Date().toISOString(),
    ...(matchedPlan ? { plan_key: matchedPlan.key, plan_id: matchedPlan.id } : {})
  }

  const resolvedArenaId = await updateArenaSubscriptionRecord({
    arenaId,
    subscriptionId,
    payload
  })

  console.info('[stripe-webhook] Invoice paid — access renewed', {
    subscription_id: subscriptionId,
    period_end: periodEnd,
    arena_id: resolvedArenaId ?? '(no metadata)'
  })

  await logAuditEvent({
    entityType: 'arena_subscription',
    entityId: resolvedArenaId ?? subscriptionId,
    action: 'invoice.paid',
    actorId: eventId,
    actorType: 'stripe_webhook',
    newValue: {
      status: 'active',
      current_period_end: periodEnd,
      plan_key: matchedPlan?.key ?? null
    },
    metadata: { stripe_event_id: eventId, stripe_subscription_id: subscriptionId, invoice_id: invoice.id }
  })
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice, eventId: string) {
  const supabase = getSupabaseAdmin()

  const subscriptionRef = invoice.parent?.subscription_details?.subscription
  const subscriptionId =
    typeof subscriptionRef === 'string'
      ? subscriptionRef
      : subscriptionRef?.id

  if (!subscriptionId) return

  const arenaId = await resolveArenaIdBySubscriptionId(subscriptionId)

  const updateQuery = supabase
    .from('arena_subscriptions')
    .update({ status: 'past_due', updated_at: new Date().toISOString() })

  const { error } = arenaId
    ? await updateQuery.eq('arena_id', arenaId)
    : await updateQuery.eq('stripe_subscription_id', subscriptionId)

  if (error) {
    console.error('[stripe-webhook] handleInvoicePaymentFailed — update failed', error)
    throw error
  }

  console.warn('[stripe-webhook] Invoice payment failed', {
    subscription_id: subscriptionId,
    attempt_count: invoice.attempt_count
  })

  await logAuditEvent({
    entityType: 'arena_subscription',
    entityId: arenaId ?? subscriptionId,
    action: 'invoice.payment_failed',
    actorId: eventId,
    actorType: 'stripe_webhook',
    newValue: { status: 'past_due' },
    metadata: {
      stripe_event_id: eventId,
      stripe_subscription_id: subscriptionId,
      invoice_id: invoice.id,
      attempt_count: invoice.attempt_count
    }
  })
}

async function handleInvoiceActionRequired(invoice: Stripe.Invoice, eventId: string) {
  const supabase = getSupabaseAdmin()

  const subscriptionRef = invoice.parent?.subscription_details?.subscription
  const subscriptionId =
    typeof subscriptionRef === 'string'
      ? subscriptionRef
      : subscriptionRef?.id

  if (!subscriptionId) return

  const arenaId = await resolveArenaIdBySubscriptionId(subscriptionId)

  const updateQuery = supabase
    .from('arena_subscriptions')
    .update({ status: 'incomplete', updated_at: new Date().toISOString() })

  const { error } = arenaId
    ? await updateQuery.eq('arena_id', arenaId)
    : await updateQuery.eq('stripe_subscription_id', subscriptionId)

  if (error) {
    console.error('[stripe-webhook] handleInvoiceActionRequired — update failed', error)
    throw error
  }

  console.warn('[stripe-webhook] Invoice requires action (3DS)', {
    subscription_id: subscriptionId,
    invoice_id: invoice.id
  })

  await logAuditEvent({
    entityType: 'arena_subscription',
    entityId: arenaId ?? subscriptionId,
    action: 'invoice.action_required',
    actorId: eventId,
    actorType: 'stripe_webhook',
    newValue: { status: 'incomplete' },
    metadata: {
      stripe_event_id: eventId,
      stripe_subscription_id: subscriptionId,
      invoice_id: invoice.id
    }
  })
}
