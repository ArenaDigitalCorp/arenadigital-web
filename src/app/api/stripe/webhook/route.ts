import { stripe } from '@/lib/stripe.client'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import {
  InvalidStripeWebhookSignatureError,
  MissingStripeSignatureError
} from '@/modules/stripe/errors'
import { STRIPE_PLANS } from '@/modules/stripe/stripe-plans'
import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'

export const config = { api: { bodyParser: false } }

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
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_action_required':
        await handleInvoiceActionRequired(event.data.object as Stripe.Invoice)
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

function resolveSubscriptionFields(subscription: Stripe.Subscription) {
  const rawPeriodEnd = subscription.items.data[0]?.current_period_end
  const periodEnd = rawPeriodEnd
    ? new Date(rawPeriodEnd * 1000).toISOString()
    : null

  const canceledAt = subscription.canceled_at
    ? new Date(subscription.canceled_at * 1000).toISOString()
    : null

  const stripePriceId = subscription.items?.data?.[0]?.price?.id ?? null
  const matchedPlan = stripePriceId
    ? STRIPE_PLANS.find((p) => p.stripePriceId === stripePriceId)
    : null

  return { periodEnd, canceledAt, matchedPlan }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const supabase = getSupabaseAdmin()
  const { periodEnd, canceledAt, matchedPlan } = resolveSubscriptionFields(subscription)
  const arenaId = subscription.metadata?.arena_id

  const payload = {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: getCustomerId(subscription),
    status: subscription.status,
    current_period_end: periodEnd,
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: canceledAt,
    updated_at: new Date().toISOString(),
    ...(matchedPlan ? { plan_key: matchedPlan.key } : {})
  }

  if (arenaId) {
    const { error } = await supabase
      .from('arena_subscriptions')
      .upsert({ arena_id: arenaId, ...payload }, { onConflict: 'arena_id' })

    if (error) {
      console.error('[stripe-webhook] handleSubscriptionUpdated — upsert failed', error)
      throw error
    }
  } else {
    const { error } = await supabase
      .from('arena_subscriptions')
      .update(payload)
      .eq('stripe_subscription_id', subscription.id)

    if (error) {
      console.error('[stripe-webhook] handleSubscriptionUpdated — update failed', error)
      throw error
    }
  }

  console.info('[stripe-webhook] Subscription updated', {
    subscription_id: subscription.id,
    status: subscription.status,
    arena_id: arenaId ?? '(no metadata)'
  })
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const supabase = getSupabaseAdmin()
  const arenaId = subscription.metadata?.arena_id

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
      .upsert({ arena_id: arenaId, stripe_customer_id: getCustomerId(subscription), ...payload }, { onConflict: 'arena_id' })

    if (error) {
      console.error('[stripe-webhook] handleSubscriptionDeleted — upsert failed', error)
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
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const supabase = getSupabaseAdmin()

  const subscriptionRef = invoice.parent?.subscription_details?.subscription
  const subscriptionId =
    typeof subscriptionRef === 'string'
      ? subscriptionRef
      : subscriptionRef?.id

  if (!subscriptionId) return

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const arenaId = subscription.metadata?.arena_id

  const rawPeriodEnd = subscription.items.data[0]?.current_period_end
  const periodEnd = rawPeriodEnd
    ? new Date(rawPeriodEnd * 1000).toISOString()
    : null

  const payload = {
    stripe_subscription_id: subscriptionId,
    status: 'active' as const,
    current_period_end: periodEnd,
    updated_at: new Date().toISOString()
  }

  if (arenaId) {
    const { error } = await supabase
      .from('arena_subscriptions')
      .upsert({ arena_id: arenaId, stripe_customer_id: getCustomerId(subscription), ...payload }, { onConflict: 'arena_id' })

    if (error) {
      console.error('[stripe-webhook] handleInvoicePaid — upsert failed', error)
      throw error
    }
  } else {
    const { error } = await supabase
      .from('arena_subscriptions')
      .update(payload)
      .eq('stripe_subscription_id', subscriptionId)

    if (error) {
      console.error('[stripe-webhook] handleInvoicePaid — update failed', error)
      throw error
    }
  }

  console.info('[stripe-webhook] Invoice paid — access renewed', {
    subscription_id: subscriptionId,
    period_end: periodEnd,
    arena_id: arenaId ?? '(no metadata)'
  })
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const supabase = getSupabaseAdmin()

  const subscriptionRef = invoice.parent?.subscription_details?.subscription
  const subscriptionId =
    typeof subscriptionRef === 'string'
      ? subscriptionRef
      : subscriptionRef?.id

  if (!subscriptionId) return

  const { error } = await supabase
    .from('arena_subscriptions')
    .update({ status: 'past_due', updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', subscriptionId)

  if (error) {
    console.error('[stripe-webhook] handleInvoicePaymentFailed — update failed', error)
    throw error
  }

  console.warn('[stripe-webhook] Invoice payment failed', {
    subscription_id: subscriptionId,
    attempt_count: invoice.attempt_count
  })
}

async function handleInvoiceActionRequired(invoice: Stripe.Invoice) {
  const supabase = getSupabaseAdmin()

  const subscriptionRef = invoice.parent?.subscription_details?.subscription
  const subscriptionId =
    typeof subscriptionRef === 'string'
      ? subscriptionRef
      : subscriptionRef?.id

  if (!subscriptionId) return

  const { error } = await supabase
    .from('arena_subscriptions')
    .update({ status: 'incomplete', updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', subscriptionId)

  if (error) {
    console.error('[stripe-webhook] handleInvoiceActionRequired — update failed', error)
    throw error
  }

  console.warn('[stripe-webhook] Invoice requires action (3DS)', {
    subscription_id: subscriptionId,
    invoice_id: invoice.id
  })
}
