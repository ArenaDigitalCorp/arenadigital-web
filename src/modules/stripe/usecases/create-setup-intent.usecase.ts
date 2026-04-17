import { stripe } from '@/lib/stripe.client'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { InvalidPlanKeyError, StripeConfigurationError } from '@/modules/stripe/errors'
import {
  planKeySchema,
  resolveCheckoutPlanKey,
  type PlanKey
} from '@/modules/stripe/stripe-plans'
import { fetchPlanByKey } from '@/modules/stripe/repositories/subscription-plans.repository'
import { logAuditEvent } from '@/modules/audit/audit-log.service'

export type CreateSetupIntentResponse = {
  clientSecret: string
  customerId: string
  planKey: PlanKey
  planLabel: string
  priceCents: number
}

export async function createSetupIntent(
  arenaId: string,
  selectedPlanKey: PlanKey,
  ownerEmail: string,
  ownerName?: string | null,
  actorId?: string | null
): Promise<CreateSetupIntentResponse> {
  const supabase = getSupabaseAdmin()

  const { data: subscription } = await supabase
    .from('arena_subscriptions')
    .select('stripe_customer_id, status')
    .eq('arena_id', arenaId)
    .maybeSingle()

  let stripeCustomerId: string | null = subscription?.stripe_customer_id ?? null
  const parsedPlanKey = planKeySchema.safeParse(selectedPlanKey)
  if (!parsedPlanKey.success) throw new InvalidPlanKeyError()
  const planKey = resolveCheckoutPlanKey(parsedPlanKey.data)

  const plan = await fetchPlanByKey(planKey)
  if (!plan) throw new InvalidPlanKeyError()

  if (!plan.stripe_price_id) {
    throw new StripeConfigurationError(
      `Stripe Price ID para o plano "${planKey}" não está configurado. Atualize subscription_plans.stripe_price_id.`
    )
  }

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: ownerEmail,
      name: ownerName ?? undefined,
      metadata: { arena_id: arenaId }
    })

    stripeCustomerId = customer.id
  }

  const { error: upsertError } = await supabase.from('arena_subscriptions').upsert(
    {
      arena_id: arenaId,
      stripe_customer_id: stripeCustomerId,
      plan_key: planKey,
      plan_id: plan.id,
      status: subscription?.status ?? 'incomplete',
      updated_at: new Date().toISOString()
    },
    { onConflict: 'arena_id' }
  )

  if (upsertError) {
    console.error('[stripe] create-setup-intent — DB upsert failed', {
      customerId: stripeCustomerId,
      error: upsertError
    })
    throw new StripeConfigurationError(upsertError.message)
  }

  await logAuditEvent({
    entityType: 'arena_subscription',
    entityId: arenaId,
    action: 'subscription.setup_intent_created',
    actorId: actorId ?? ownerEmail,
    actorType: 'user',
    newValue: {
      plan_key: planKey,
      plan_id: plan.id,
      stripe_customer_id: stripeCustomerId
    },
    metadata: {
      arena_id: arenaId,
      reused_customer: Boolean(subscription?.stripe_customer_id)
    }
  })

  const setupIntent = await stripe.setupIntents.create(
    {
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      usage: 'off_session',
      metadata: { arena_id: arenaId, plan_key: planKey }
    },
    { idempotencyKey: `setup-intent-${arenaId}-${planKey}` }
  )

  if (!setupIntent.client_secret) {
    throw new StripeConfigurationError('SetupIntent did not return a client_secret.')
  }

  return {
    clientSecret: setupIntent.client_secret,
    customerId: stripeCustomerId,
    planKey,
    planLabel: plan.label,
    priceCents: plan.price_cents
  }
}
