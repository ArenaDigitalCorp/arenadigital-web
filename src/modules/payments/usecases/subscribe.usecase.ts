import z from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { logAuditEvent } from '@/modules/audit/audit-log.service'
import type { DomainSubscription } from '@/modules/payments/domain/types'
import {
  CreateSubscriptionFailedError,
  InvalidPlanKeyError,
  PaymentConfigurationError
} from '@/modules/payments/errors'
import { getPaymentGateway } from '@/modules/payments/gateway'
import type { SubscriptionPlanInfo } from '@/modules/payments/gateway/payment-gateway.interface'
import { planKeySchema, resolveCheckoutPlanKey } from '@/modules/payments/plans'
import {
  fetchPlanByKey,
  type SubscriptionPlanRow
} from '@/modules/payments/repositories/subscription-plans.repository'

export const SubscribeRequestSchema = z.object({
  arenaId: z.string().uuid(),
  planKey: planKeySchema,
  paymentMethodId: z.string().min(1)
})

export type SubscribeRequest = z.infer<typeof SubscribeRequestSchema> & {
  actorId?: string | null
  remoteIp?: string
}

export type SubscribeResponse =
  | { status: 'active' }
  | { status: 'requires_action'; clientSecret: string }
  | { status: 'failed'; message: string }

function toPlanInfo(plan: SubscriptionPlanRow): SubscriptionPlanInfo {
  return {
    key: plan.key,
    label: plan.label,
    priceCents: plan.price_cents,
    gatewayPriceId: plan.gateway_price_id
  }
}

function requiresAdditionalAction(subscription: DomainSubscription): string | null {
  if (
    subscription.status === 'incomplete' &&
    subscription.latestInvoice?.requiresActionClientSecret
  ) {
    return subscription.latestInvoice.requiresActionClientSecret
  }
  return null
}

function buildFailureMessage(subscription: DomainSubscription): string {
  return subscription.latestInvoice?.requiresPaymentMethod
    ? 'Payment failed. Please try a different card.'
    : `Subscription is ${subscription.status}. Please contact support.`
}

async function persistSubscriptionState(input: {
  arenaId: string
  gatewaySubscriptionId: string
  planId: string
  planKey: string
  status: string
  currentPeriodEnd: string | null
}) {
  const { error } = await getSupabaseAdmin()
    .from('arena_subscriptions')
    .update({
      gateway_subscription_id: input.gatewaySubscriptionId,
      plan_id: input.planId,
      plan_key: input.planKey,
      status: input.status,
      current_period_end: input.currentPeriodEnd,
      updated_at: new Date().toISOString()
    })
    .eq('arena_id', input.arenaId)

  if (error) {
    console.error(
      '[payments] subscribe — DB update failed. Webhook will sync state via metadata.arena_id.',
      {
        subscriptionId: input.gatewaySubscriptionId,
        arenaId: input.arenaId,
        error
      }
    )
  }
}

export async function subscribe(request: SubscribeRequest): Promise<SubscribeResponse> {
  const supabase = getSupabaseAdmin()
  const gateway = getPaymentGateway()

  const planKey = resolveCheckoutPlanKey(request.planKey)
  const plan = await fetchPlanByKey(planKey)
  if (!plan) throw new InvalidPlanKeyError()

  if (gateway.providerName === 'stripe' && !plan.gateway_price_id) {
    throw new PaymentConfigurationError(
      `Stripe price_id não configurado para o plano "${plan.key}".`
    )
  }

  const planInfo = toPlanInfo(plan)

  const { data: record } = await supabase
    .from('arena_subscriptions')
    .select('gateway_customer_id, plan_key, plan_id, gateway_subscription_id, status')
    .eq('arena_id', request.arenaId)
    .maybeSingle()

  if (!record?.gateway_customer_id) {
    throw new PaymentConfigurationError(
      'No customer found for this arena. Call setup-intent first.'
    )
  }

  await supabase
    .from('arena_subscriptions')
    .update({
      plan_key: plan.key,
      plan_id: plan.id,
      updated_at: new Date().toISOString()
    })
    .eq('arena_id', request.arenaId)

  if (record.gateway_subscription_id) {
    const existingSub = await gateway.retrieveSubscription(record.gateway_subscription_id)
    const isSamePlan =
      gateway.providerName === 'stripe'
        ? existingSub?.primaryItem?.priceId === plan.gateway_price_id
        : record.plan_key === plan.key

    if (
      existingSub &&
      (existingSub.status === 'active' || existingSub.status === 'trialing') &&
      isSamePlan
    ) {
      const updated = await gateway.updateSubscriptionPaymentMethod({
        subscriptionId: existingSub.id,
        paymentMethodId: request.paymentMethodId,
        idempotencyKey: `update-payment-method-${request.arenaId}-${plan.key}`
      })

      await persistSubscriptionState({
        arenaId: request.arenaId,
        gatewaySubscriptionId: updated.id,
        planId: plan.id,
        planKey: plan.key,
        status: updated.status,
        currentPeriodEnd: updated.primaryItem?.currentPeriodEndIso ?? null
      })

      await logAuditEvent({
        entityType: 'arena_subscription',
        entityId: request.arenaId,
        action: 'subscription.payment_method_updated',
        actorId: request.actorId ?? null,
        actorType: 'user',
        newValue: {
          status: updated.status,
          gateway_subscription_id: updated.id,
          plan_key: plan.key,
          plan_id: plan.id
        },
        metadata: { reason: 'existing_active_subscription_same_plan' }
      })

      return { status: 'active' }
    }

    if (
      existingSub &&
      (existingSub.status === 'active' || existingSub.status === 'trialing') &&
      !isSamePlan
    ) {
      const updated = await gateway.changeSubscriptionPlan({
        subscriptionId: existingSub.id,
        plan: planInfo,
        paymentMethodId: request.paymentMethodId,
        idempotencyKey: `change-plan-${request.arenaId}-${plan.key}`
      })

      const periodEnd = updated.primaryItem?.currentPeriodEndIso ?? null

      await persistSubscriptionState({
        arenaId: request.arenaId,
        gatewaySubscriptionId: updated.id,
        planId: plan.id,
        planKey: plan.key,
        status: updated.status,
        currentPeriodEnd: periodEnd
      })

      await logAuditEvent({
        entityType: 'arena_subscription',
        entityId: request.arenaId,
        action: 'subscription.plan_changed',
        actorId: request.actorId ?? null,
        actorType: 'user',
        newValue: {
          gateway_subscription_id: updated.id,
          status: updated.status,
          plan_key: plan.key,
          plan_id: plan.id,
          current_period_end: periodEnd
        },
        metadata: { previous_plan_key: record.plan_key ?? null }
      })

      if (updated.status === 'active') {
        return { status: 'active' }
      }

      const clientSecret = requiresAdditionalAction(updated)
      if (clientSecret) {
        return { status: 'requires_action', clientSecret }
      }

      return { status: 'failed', message: buildFailureMessage(updated) }
    }

    if (existingSub && existingSub.status === 'incomplete') {
      if (!isSamePlan) {
        await gateway.cancelSubscriptionImmediately(existingSub.id)
      } else {
        try {
          const result = await gateway.retryFailedPayment({
            subscriptionId: existingSub.id,
            paymentMethodId: request.paymentMethodId,
            invoiceId: existingSub.latestInvoice?.id ?? null
          })

          await supabase
            .from('arena_subscriptions')
            .update({
              status: result.paid ? 'active' : 'incomplete',
              plan_key: plan.key,
              plan_id: plan.id,
              updated_at: new Date().toISOString()
            })
            .eq('arena_id', request.arenaId)

          await logAuditEvent({
            entityType: 'arena_subscription',
            entityId: request.arenaId,
            action: result.paid
              ? 'subscription.activated'
              : 'subscription.payment_failed',
            actorId: request.actorId ?? null,
            actorType: 'user',
            newValue: {
              status: result.paid ? 'active' : 'incomplete',
              plan_key: plan.key,
              plan_id: plan.id
            },
            metadata: {
              reason: 'retry_incomplete_payment',
              gateway_subscription_id: existingSub.id,
              retry_status: result.status
            }
          })

          return result.paid
            ? { status: 'active' }
            : { status: 'failed', message: 'Payment failed. Please try a different card.' }
        } catch (err) {
          console.error('[payments] subscribe — failed to retry incomplete payment', err)
          return { status: 'failed', message: 'Payment failed. Please try a different card.' }
        }
      }
    }
  }

  let subscription: DomainSubscription
  try {
    const idempotencyKey = `subscribe-${request.arenaId}-${plan.key}`
    subscription = await gateway.createSubscription({
      customerId: record.gateway_customer_id,
      plan: planInfo,
      paymentMethodId: request.paymentMethodId,
      remoteIp: request.remoteIp,
      metadata: { arena_id: request.arenaId, plan_key: plan.key },
      idempotencyKey
    })
  } catch (error) {
    throw new CreateSubscriptionFailedError(
      error instanceof Error ? error.message : String(error)
    )
  }

  const periodEnd = subscription.primaryItem?.currentPeriodEndIso ?? null

  await persistSubscriptionState({
    arenaId: request.arenaId,
    gatewaySubscriptionId: subscription.id,
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
      gateway_subscription_id: subscription.id,
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
        gateway_subscription_id: subscription.id,
        plan_key: plan.key,
        plan_id: plan.id
      }
    })
    return { status: 'active' }
  }

  const clientSecret = requiresAdditionalAction(subscription)
  if (clientSecret) {
    return { status: 'requires_action', clientSecret }
  }

  return { status: 'failed', message: buildFailureMessage(subscription) }
}
