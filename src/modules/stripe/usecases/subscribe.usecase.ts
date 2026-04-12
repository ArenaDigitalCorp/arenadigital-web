import type Stripe from 'stripe'
import z from 'zod'
import { stripe } from '@/lib/stripe.client'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import {
  CreateSubscriptionFailedError,
  InvalidPlanKeyError,
  StripeConfigurationError
} from '@/modules/stripe/errors'
import { getStripePlanByKey, planKeySchema } from '@/modules/stripe/stripe-plans'

type SubscriptionWithInvoice = Stripe.Subscription & {
  latest_invoice: (Stripe.Invoice & {
    payment_intent: Stripe.PaymentIntent | null
  }) | null
}

export const SubscribeRequestSchema = z.object({
  arenaId: z.string().uuid(),
  paymentMethodId: z.string().min(1)
})

export type SubscribeRequest = z.infer<typeof SubscribeRequestSchema>

export type SubscribeResponse =
  | { status: 'active' }
  | { status: 'requires_action'; clientSecret: string }
  | { status: 'failed'; message: string }

export async function subscribe(request: SubscribeRequest): Promise<SubscribeResponse> {
  const supabase = getSupabaseAdmin()

  const { data: record } = await supabase
    .from('arena_subscriptions')
    .select('stripe_customer_id, plan_key, stripe_subscription_id, status')
    .eq('arena_id', request.arenaId)
    .maybeSingle()

  if (!record?.stripe_customer_id) {
    throw new StripeConfigurationError(
      'No Stripe customer found for this arena. Call setup-intent first.'
    )
  }

  if (record.stripe_subscription_id) {
    let existingSub: Stripe.Subscription | null = null
    try {
      existingSub = await stripe.subscriptions.retrieve(record.stripe_subscription_id)
    } catch {
      // not found in Stripe — proceed to create a new one
    }

    if (existingSub && (existingSub.status === 'active' || existingSub.status === 'trialing')) {
      await supabase
        .from('arena_subscriptions')
        .update({ status: existingSub.status, updated_at: new Date().toISOString() })
        .eq('arena_id', request.arenaId)
      return { status: 'active' }
    }

    if (existingSub && existingSub.status === 'incomplete') {
      try {
        await stripe.subscriptions.update(record.stripe_subscription_id, {
          default_payment_method: request.paymentMethodId
        })
        const invoice = await stripe.invoices.pay(
          typeof existingSub.latest_invoice === 'string'
            ? existingSub.latest_invoice
            : (existingSub.latest_invoice?.id ?? ''),
          { payment_method: request.paymentMethodId }
        )

        const paid = invoice.status === 'paid'
        await supabase
          .from('arena_subscriptions')
          .update({ status: paid ? 'active' : 'incomplete', updated_at: new Date().toISOString() })
          .eq('arena_id', request.arenaId)

        return paid ? { status: 'active' } : { status: 'failed', message: 'Payment failed. Please try a different card.' }
      } catch (err) {
        console.error('[stripe] subscribe — failed to pay existing incomplete invoice', err)
        return { status: 'failed', message: 'Payment failed. Please try a different card.' }
      }
    }
  }

  const parsedPlanKey = planKeySchema.safeParse(record.plan_key)
  if (!parsedPlanKey.success) throw new InvalidPlanKeyError()

  const plan = getStripePlanByKey(parsedPlanKey.data)
  if (!plan) throw new InvalidPlanKeyError()

  if (!plan.stripePriceId) {
    throw new StripeConfigurationError(
      `Stripe Price ID for plan "${plan.key}" is not configured.`
    )
  }

  let subscription: SubscriptionWithInvoice

  try {
    subscription = await stripe.subscriptions.create(
      {
        customer: record.stripe_customer_id,
        items: [{ price: plan.stripePriceId }],
        default_payment_method: request.paymentMethodId,
        payment_behavior: 'allow_incomplete',
        collection_method: 'charge_automatically',
        payment_settings: {
          payment_method_types: ['card'],
          save_default_payment_method: 'off'
        },
        metadata: { arena_id: request.arenaId },
        expand: ['latest_invoice.payment_intent']
      },
      { idempotencyKey: `subscribe-${request.arenaId}-${plan.key}` }
    ) as SubscriptionWithInvoice
  } catch (error) {
    throw new CreateSubscriptionFailedError(
      error instanceof Error ? error.message : String(error)
    )
  }

  const rawPeriodEnd = subscription.items.data[0]?.current_period_end
  const periodEnd = rawPeriodEnd
    ? new Date(rawPeriodEnd * 1000).toISOString()
    : null

  const { error: updateError } = await supabase
    .from('arena_subscriptions')
    .update({
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      current_period_end: periodEnd,
      updated_at: new Date().toISOString()
    })
    .eq('arena_id', request.arenaId)

  if (updateError) {
    console.error('[stripe] subscribe — DB update failed. Webhook will sync state via metadata.arena_id.', {
      subscriptionId: subscription.id,
      arenaId: request.arenaId,
      error: updateError
    })
  }

  if (subscription.status === 'active') {
    return { status: 'active' }
  }

  const paymentIntent = subscription.latest_invoice?.payment_intent

  if (
    subscription.status === 'incomplete' &&
    paymentIntent?.status === 'requires_action' &&
    paymentIntent.client_secret
  ) {
    return {
      status: 'requires_action',
      clientSecret: paymentIntent.client_secret
    }
  }

  const failureMessage =
    paymentIntent?.status === 'requires_payment_method'
      ? 'Payment failed. Please try a different card.'
      : `Subscription is ${subscription.status}. Please contact support.`

  return { status: 'failed', message: failureMessage }
}
