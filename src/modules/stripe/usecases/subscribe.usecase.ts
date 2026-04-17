import type Stripe from 'stripe'
import z from 'zod'
import { stripe } from '@/lib/stripe.client'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import {
  CreateSubscriptionFailedError,
  InvalidPlanKeyError,
  StripeConfigurationError
} from '@/modules/stripe/errors'
import { planKeySchema, resolveCheckoutPlanKey } from '@/modules/stripe/stripe-plans'
import { fetchPlanByKey } from '@/modules/stripe/repositories/subscription-plans.repository'
import { logAuditEvent } from '@/modules/audit/audit-log.service'

type SubscriptionWithInvoice = Stripe.Subscription & {
  latest_invoice: (Stripe.Invoice & {
    payment_intent: Stripe.PaymentIntent | null
  }) | null
}

export const SubscribeRequestSchema = z.object({
  arenaId: z.string().uuid(),
  planKey: planKeySchema,
  paymentMethodId: z.string().min(1)
})

export type SubscribeRequest = z.infer<typeof SubscribeRequestSchema> & {
  actorId?: string | null
}

export type SubscribeResponse =
  | { status: 'active' }
  | { status: 'requires_action'; clientSecret: string }
  | { status: 'failed'; message: string }

function requiresAdditionalAction(subscription: SubscriptionWithInvoice) {
  const paymentIntent = subscription.latest_invoice?.payment_intent

  if (
    subscription.status === 'incomplete' &&
    paymentIntent?.status === 'requires_action' &&
    paymentIntent.client_secret
  ) {
    return paymentIntent.client_secret
  }

  return null
}

function buildFailureMessage(subscription: SubscriptionWithInvoice) {
  const paymentIntent = subscription.latest_invoice?.payment_intent

  return paymentIntent?.status === 'requires_payment_method'
    ? 'Payment failed. Please try a different card.'
    : `Subscription is ${subscription.status}. Please contact support.`
}

async function persistSubscriptionState(input: {
  arenaId: string
  stripeSubscriptionId: string
  planId: string
  planKey: string
  status: string
  currentPeriodEnd: string | null
}) {
  const { error } = await getSupabaseAdmin()
    .from('arena_subscriptions')
    .update({
      stripe_subscription_id: input.stripeSubscriptionId,
      plan_id: input.planId,
      plan_key: input.planKey,
      status: input.status,
      current_period_end: input.currentPeriodEnd,
      updated_at: new Date().toISOString()
    })
    .eq('arena_id', input.arenaId)

  if (error) {
    console.error('[stripe] subscribe — DB update failed. Webhook will sync state via metadata.arena_id.', {
      subscriptionId: input.stripeSubscriptionId,
      arenaId: input.arenaId,
      error
    })
  }
}

async function syncDefaultPaymentMethod(customerId: string, paymentMethodId: string) {
  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId
    }
  })
}

export async function subscribe(request: SubscribeRequest): Promise<SubscribeResponse> {
  const supabase = getSupabaseAdmin()
  const planKey = resolveCheckoutPlanKey(request.planKey)
  const plan = await fetchPlanByKey(planKey)
  if (!plan) throw new InvalidPlanKeyError()

  if (!plan.stripe_price_id) {
    throw new StripeConfigurationError(
      `Stripe Price ID para o plano "${plan.key}" não está configurado.`
    )
  }

  const { data: record } = await supabase
    .from('arena_subscriptions')
    .select('stripe_customer_id, plan_key, plan_id, stripe_subscription_id, status')
    .eq('arena_id', request.arenaId)
    .maybeSingle()

  if (!record?.stripe_customer_id) {
    throw new StripeConfigurationError(
      'No Stripe customer found for this arena. Call setup-intent first.'
    )
  }

  await syncDefaultPaymentMethod(record.stripe_customer_id, request.paymentMethodId)

  await supabase
    .from('arena_subscriptions')
    .update({
      plan_key: plan.key,
      plan_id: plan.id,
      updated_at: new Date().toISOString()
    })
    .eq('arena_id', request.arenaId)

  if (record.stripe_subscription_id) {
    let existingSub: Stripe.Subscription | null = null
    try {
      existingSub = await stripe.subscriptions.retrieve(record.stripe_subscription_id)
    } catch {
      existingSub = null
    }

    const currentStripePriceId = existingSub?.items.data[0]?.price?.id ?? null
    const isSamePlan = currentStripePriceId === plan.stripe_price_id

    if (existingSub && (existingSub.status === 'active' || existingSub.status === 'trialing') && isSamePlan) {
      const updatedSubscription = await stripe.subscriptions.update(
        existingSub.id,
        {
          default_payment_method: request.paymentMethodId
        },
        { idempotencyKey: `update-payment-method-${request.arenaId}-${plan.key}` }
      )

      await persistSubscriptionState({
        arenaId: request.arenaId,
        stripeSubscriptionId: updatedSubscription.id,
        planId: plan.id,
        planKey: plan.key,
        status: updatedSubscription.status,
        currentPeriodEnd: updatedSubscription.items.data[0]?.current_period_end
          ? new Date(updatedSubscription.items.data[0].current_period_end * 1000).toISOString()
          : null
      })

      await logAuditEvent({
        entityType: 'arena_subscription',
        entityId: request.arenaId,
        action: 'subscription.payment_method_updated',
        actorId: request.actorId ?? null,
        actorType: 'user',
        newValue: {
          status: updatedSubscription.status,
          stripe_subscription_id: updatedSubscription.id,
          plan_key: plan.key,
          plan_id: plan.id
        },
        metadata: { reason: 'existing_active_subscription_same_plan' }
      })

      return { status: 'active' }
    }

    if (existingSub && (existingSub.status === 'active' || existingSub.status === 'trialing') && !isSamePlan) {
      const existingItemId = existingSub.items.data[0]?.id
      if (!existingItemId) {
        throw new CreateSubscriptionFailedError('Existing subscription item not found')
      }

      const updatedSubscription = await stripe.subscriptions.update(
        existingSub.id,
        {
          items: [{ id: existingItemId, price: plan.stripe_price_id }],
          default_payment_method: request.paymentMethodId,
          payment_behavior: 'allow_incomplete',
          proration_behavior: 'create_prorations',
          expand: ['latest_invoice.payment_intent']
        },
        { idempotencyKey: `change-plan-${request.arenaId}-${plan.key}` }
      ) as SubscriptionWithInvoice

      const rawPeriodEnd = updatedSubscription.items.data[0]?.current_period_end
      const periodEnd = rawPeriodEnd
        ? new Date(rawPeriodEnd * 1000).toISOString()
        : null

      await persistSubscriptionState({
        arenaId: request.arenaId,
        stripeSubscriptionId: updatedSubscription.id,
        planId: plan.id,
        planKey: plan.key,
        status: updatedSubscription.status,
        currentPeriodEnd: periodEnd
      })

      await logAuditEvent({
        entityType: 'arena_subscription',
        entityId: request.arenaId,
        action: 'subscription.plan_changed',
        actorId: request.actorId ?? null,
        actorType: 'user',
        newValue: {
          stripe_subscription_id: updatedSubscription.id,
          status: updatedSubscription.status,
          plan_key: plan.key,
          plan_id: plan.id,
          current_period_end: periodEnd
        },
        metadata: { previous_plan_key: record.plan_key ?? null }
      })

      if (updatedSubscription.status === 'active') {
        return { status: 'active' }
      }

      const clientSecret = requiresAdditionalAction(updatedSubscription)
      if (clientSecret) {
        return { status: 'requires_action', clientSecret }
      }

      return { status: 'failed', message: buildFailureMessage(updatedSubscription) }
    }

    if (existingSub && existingSub.status === 'incomplete') {
      if (!isSamePlan) {
        await stripe.subscriptions.cancel(existingSub.id)
      } else {
        try {
          await stripe.subscriptions.update(existingSub.id, {
            default_payment_method: request.paymentMethodId
          })

          const invoiceId =
            typeof existingSub.latest_invoice === 'string'
              ? existingSub.latest_invoice
              : (existingSub.latest_invoice?.id ?? '')

          const invoice = await stripe.invoices.pay(invoiceId, {
            payment_method: request.paymentMethodId
          })

          const paid = invoice.status === 'paid'
          await supabase
            .from('arena_subscriptions')
            .update({
              status: paid ? 'active' : 'incomplete',
              plan_key: plan.key,
              plan_id: plan.id,
              updated_at: new Date().toISOString()
            })
            .eq('arena_id', request.arenaId)

          await logAuditEvent({
            entityType: 'arena_subscription',
            entityId: request.arenaId,
            action: paid ? 'subscription.activated' : 'subscription.payment_failed',
            actorId: request.actorId ?? null,
            actorType: 'user',
            newValue: {
              status: paid ? 'active' : 'incomplete',
              invoice_id: invoice.id,
              plan_key: plan.key,
              plan_id: plan.id
            },
            metadata: {
              reason: 'retry_incomplete_invoice',
              stripe_subscription_id: existingSub.id
            }
          })

          return paid
            ? { status: 'active' }
            : { status: 'failed', message: 'Payment failed. Please try a different card.' }
        } catch (err) {
          console.error('[stripe] subscribe — failed to pay existing incomplete invoice', err)
          return { status: 'failed', message: 'Payment failed. Please try a different card.' }
        }
      }
    }
  }

  let subscription: SubscriptionWithInvoice

  try {
    subscription = await stripe.subscriptions.create(
      {
        customer: record.stripe_customer_id,
        items: [{ price: plan.stripe_price_id }],
        default_payment_method: request.paymentMethodId,
        payment_behavior: 'allow_incomplete',
        collection_method: 'charge_automatically',
        payment_settings: {
          payment_method_types: ['card'],
          save_default_payment_method: 'off'
        },
        metadata: { arena_id: request.arenaId, plan_key: plan.key },
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

  await persistSubscriptionState({
    arenaId: request.arenaId,
    stripeSubscriptionId: subscription.id,
    planId: plan.id,
    planKey: plan.key,
    status: subscription.status,
    currentPeriodEnd: periodEnd
  })

  await logAuditEvent({
    entityType: 'arena_subscription',
    entityId: request.arenaId,
    action: 'subscription.created',
    actorId: request.actorId ?? null,
    actorType: 'user',
    newValue: {
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      plan_key: plan.key,
      plan_id: plan.id,
      current_period_end: periodEnd
    }
  })

  if (subscription.status === 'active') {
    await logAuditEvent({
      entityType: 'arena_subscription',
      entityId: request.arenaId,
      action: 'subscription.activated',
      actorId: request.actorId ?? null,
      actorType: 'user',
      newValue: {
        status: 'active',
        stripe_subscription_id: subscription.id,
        plan_key: plan.key,
        plan_id: plan.id
      }
    })
    return { status: 'active' }
  }

  const clientSecret = requiresAdditionalAction(subscription)
  if (clientSecret) {
    return {
      status: 'requires_action',
      clientSecret
    }
  }

  return { status: 'failed', message: buildFailureMessage(subscription) }
}
