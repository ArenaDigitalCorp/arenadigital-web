import { stripe } from '@/lib/stripe.client'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { StripeConfigurationError } from '@/modules/stripe/errors'

export async function cancelSubscription(arenaId: string): Promise<void> {
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
}

export async function reactivateSubscription(arenaId: string): Promise<void> {
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
}
