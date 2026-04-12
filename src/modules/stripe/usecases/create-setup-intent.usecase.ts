import { stripe } from '@/lib/stripe.client'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { InvalidPlanKeyError, StripeConfigurationError } from '@/modules/stripe/errors'
import { getStripePlanByKey, planKeySchema, type PlanKey } from '@/modules/stripe/stripe-plans'

export type CreateSetupIntentResponse = {
  clientSecret: string
  customerId: string
  planKey: PlanKey
  planLabel: string
  priceCents: number
}

export async function createSetupIntent(
  arenaId: string,
  ownerEmail: string,
  ownerName?: string | null
): Promise<CreateSetupIntentResponse> {
  const supabase = getSupabaseAdmin()

  const { data: subscription } = await supabase
    .from('arena_subscriptions')
    .select('stripe_customer_id, plan_key')
    .eq('arena_id', arenaId)
    .maybeSingle()

  let planKey: PlanKey
  let stripeCustomerId: string | null = subscription?.stripe_customer_id ?? null

  if (subscription?.plan_key) {
    const parsed = planKeySchema.safeParse(subscription.plan_key)
    if (!parsed.success) throw new InvalidPlanKeyError()
    planKey = parsed.data
  } else {
    const { data: arena } = await supabase
      .from('arenas')
      .select('plan_key')
      .eq('id', arenaId)
      .single()

    planKey = (arena?.plan_key as PlanKey) ?? 'starter'
  }

  const plan = getStripePlanByKey(planKey)
  if (!plan) throw new InvalidPlanKeyError()

  if (!plan.stripePriceId) {
    throw new StripeConfigurationError(
      `Stripe Price ID for plan "${planKey}" is not configured. Set STRIPE_PRICE_${planKey.toUpperCase()} in your environment.`
    )
  }

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: ownerEmail,
      name: ownerName ?? undefined,
      metadata: { arena_id: arenaId }
    })

    stripeCustomerId = customer.id

    const { error: upsertError } = await supabase.from('arena_subscriptions').upsert(
      {
        arena_id: arenaId,
        stripe_customer_id: stripeCustomerId,
        plan_key: planKey,
        status: 'incomplete',
        updated_at: new Date().toISOString()
      },
      { onConflict: 'arena_id' }
    )

    if (upsertError) {
      console.error('[stripe] create-setup-intent — DB upsert failed', { customerId: stripeCustomerId, error: upsertError })
      throw new StripeConfigurationError(upsertError.message)
    }
  }

  const setupIntent = await stripe.setupIntents.create(
    {
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      usage: 'off_session',
      metadata: { arena_id: arenaId, plan_key: planKey }
    },
    { idempotencyKey: `setup-intent-${arenaId}` }
  )

  if (!setupIntent.client_secret) {
    throw new StripeConfigurationError('SetupIntent did not return a client_secret.')
  }

  return {
    clientSecret: setupIntent.client_secret,
    customerId: stripeCustomerId,
    planKey,
    planLabel: plan.label,
    priceCents: plan.priceCents
  }
}
