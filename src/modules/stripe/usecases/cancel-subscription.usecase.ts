import { stripe } from '@/lib/stripe.client'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { StripeConfigurationError } from '@/modules/stripe/errors'
import { logAuditEvent } from '@/modules/audit/audit-log.service'

export async function cancelSubscription(arenaId: string, actorId?: string): Promise<void> {
  const supabase = getSupabaseAdmin()

  const { data } = await supabase
    .from('arena_subscriptions')
    .select('stripe_subscription_id')
    .eq('arena_id', arenaId)
    .maybeSingle()

  if (!data?.stripe_subscription_id) {
    throw new StripeConfigurationError('No active subscription found for this arena.')
  }

  await stripe.subscriptions.update(data.stripe_subscription_id, {
    cancel_at_period_end: true
  })

  const { error } = await supabase
    .from('arena_subscriptions')
    .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
    .eq('arena_id', arenaId)

  if (error) {
    console.error('[stripe] cancelSubscription — DB update failed', { subscriptionId: data.stripe_subscription_id, error })
    throw new StripeConfigurationError(error.message)
  }

  await logAuditEvent({
    entityType: 'arena_subscription',
    entityId: arenaId,
    action: 'subscription.cancel_requested',
    actorId: actorId ?? null,
    actorType: 'user',
    newValue: { cancel_at_period_end: true },
    metadata: { stripe_subscription_id: data.stripe_subscription_id }
  })
}

export async function reactivateSubscription(arenaId: string, actorId?: string): Promise<void> {
  const supabase = getSupabaseAdmin()

  const { data } = await supabase
    .from('arena_subscriptions')
    .select('stripe_subscription_id')
    .eq('arena_id', arenaId)
    .maybeSingle()

  if (!data?.stripe_subscription_id) {
    throw new StripeConfigurationError('No subscription found for this arena.')
  }

  await stripe.subscriptions.update(data.stripe_subscription_id, {
    cancel_at_period_end: false
  })

  const { error } = await supabase
    .from('arena_subscriptions')
    .update({ cancel_at_period_end: false, updated_at: new Date().toISOString() })
    .eq('arena_id', arenaId)

  if (error) {
    console.error('[stripe] reactivateSubscription — DB update failed', { subscriptionId: data.stripe_subscription_id, error })
    throw new StripeConfigurationError(error.message)
  }

  await logAuditEvent({
    entityType: 'arena_subscription',
    entityId: arenaId,
    action: 'subscription.reactivated',
    actorId: actorId ?? null,
    actorType: 'user',
    newValue: { cancel_at_period_end: false },
    metadata: { stripe_subscription_id: data.stripe_subscription_id }
  })
}
