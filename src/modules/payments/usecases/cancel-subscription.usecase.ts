import { getSupabaseAdmin } from '@/lib/supabase-server'
import { logAuditEvent } from '@/modules/audit/audit-log.service'
import { PaymentApiError, PaymentConfigurationError, SubscriptionCancellationChangedError } from '@/modules/payments/errors'
import { getPaymentGateway } from '@/modules/payments/gateway'
import { EXPERIMENTAL_PLAN_KEY } from '@/modules/payments/plans'
import { hasActiveSubscriptionWithdrawal } from './subscription-withdrawal.usecase'

export type RenewalCancellationExpectation = {
  subscriptionId: string
  customerId: string | null
  currentPeriodEnd: string | null
}

export async function cancelSubscription(
  arenaId: string,
  actorId?: string,
  expected?: RenewalCancellationExpectation,
): Promise<{ currentPeriodEnd: string | null }> {
  const supabase = getSupabaseAdmin()
  const gateway = getPaymentGateway()

  const { data, error: subscriptionError } = await supabase
    .from('arena_subscriptions')
    .select('gateway_subscription_id, gateway_customer_id, current_period_end, plan_key')
    .eq('arena_id', arenaId)
    .maybeSingle()

  if (subscriptionError) throw new PaymentConfigurationError(subscriptionError.message)
  if (expected && (!data || data.gateway_subscription_id !== expected.subscriptionId
    || data.gateway_customer_id !== expected.customerId || data.current_period_end !== expected.currentPeriodEnd)) {
    throw new SubscriptionCancellationChangedError()
  }
  if (!data?.gateway_subscription_id) {
    throw new PaymentConfigurationError('No active subscription found for this arena.')
  }

  const scheduled = await gateway.setSubscriptionCancelAtPeriodEnd(data.gateway_subscription_id, true, {
    customerId: data.gateway_customer_id,
    currentPeriodEnd: data.current_period_end,
    isExperimental: data.plan_key === EXPERIMENTAL_PLAN_KEY,
  })

  const update = supabase
    .from('arena_subscriptions')
    .update({
      cancel_at_period_end: true,
      ...(scheduled ? { current_period_end: scheduled.currentPeriodEnd } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('arena_id', arenaId)
    .eq('gateway_subscription_id', data.gateway_subscription_id)
  const unchanged = scheduled
    ? (data.current_period_end
      ? update.eq('current_period_end', data.current_period_end)
      : update.is('current_period_end', null))
    : update
  const { data: updated, error } = await unchanged
    .select('arena_id')
    .maybeSingle()

  if (error) {
    console.error('[payments] cancelSubscription — DB update failed', {
      subscriptionId: data.gateway_subscription_id,
      error
    })
    throw new PaymentConfigurationError(error.message)
  }
  if (!updated) throw new SubscriptionCancellationChangedError()

  await logAuditEvent({
    entityType: 'arena_subscription',
    entityId: arenaId,
    action: 'subscription.cancel_requested',
    actorId: actorId ?? null,
    actorType: 'user',
    newValue: {
      cancel_at_period_end: true,
      ...(scheduled ? { current_period_end: scheduled.currentPeriodEnd } : {}),
    },
    metadata: { gateway_subscription_id: data.gateway_subscription_id }
  })
  return { currentPeriodEnd: scheduled ? scheduled.currentPeriodEnd : data.current_period_end }
}

export async function reactivateSubscription(
  arenaId: string,
  actorId?: string
): Promise<void> {
  const supabase = getSupabaseAdmin()
  const gateway = getPaymentGateway()

  if (gateway.providerName === 'asaas' && await hasActiveSubscriptionWithdrawal(arenaId)) {
    throw new PaymentApiError(409, 'Há uma solicitação de desistência em andamento para esta assinatura.')
  }

  const { data, error: subscriptionError } = await supabase
    .from('arena_subscriptions')
    .select('gateway_subscription_id, gateway_customer_id, current_period_end, plan_key, cancel_at_period_end')
    .eq('arena_id', arenaId)
    .maybeSingle()

  if (subscriptionError) throw new PaymentConfigurationError(subscriptionError.message)
  if (!data?.gateway_subscription_id) {
    throw new PaymentConfigurationError('No subscription found for this arena.')
  }

  if (gateway.providerName === 'asaas' && !data.cancel_at_period_end) return
  await gateway.setSubscriptionCancelAtPeriodEnd(data.gateway_subscription_id, false, {
    customerId: data.gateway_customer_id,
    currentPeriodEnd: data.current_period_end,
    isExperimental: data.plan_key === EXPERIMENTAL_PLAN_KEY,
  })

  const { data: updated, error } = await supabase
    .from('arena_subscriptions')
    .update({ cancel_at_period_end: false, updated_at: new Date().toISOString() })
    .eq('arena_id', arenaId)
    .eq('gateway_subscription_id', data.gateway_subscription_id)
    .select('arena_id')
    .maybeSingle()

  if (error) {
    console.error('[payments] reactivateSubscription — DB update failed', {
      subscriptionId: data.gateway_subscription_id,
      error
    })
    throw new PaymentConfigurationError(error.message)
  }
  if (!updated) throw new PaymentApiError(409, 'A assinatura mudou. Consulte o plano atual e tente novamente.')

  await logAuditEvent({
    entityType: 'arena_subscription',
    entityId: arenaId,
    action: 'subscription.reactivated',
    actorId: actorId ?? null,
    actorType: 'user',
    newValue: { cancel_at_period_end: false },
    metadata: { gateway_subscription_id: data.gateway_subscription_id }
  })
}
