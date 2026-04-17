import { stripe } from '@/lib/stripe.client'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { fetchPlanByKey } from '@/modules/stripe/repositories/subscription-plans.repository'
import { planKeySchema, type PlanKey } from '@/modules/stripe/stripe-plans'

export type SubscriptionStatus =
  | 'active'
  | 'incomplete'
  | 'incomplete_expired'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused'
  | 'none'

export type CardInfo = {
  brand: string
  last4: string
}

export type ArenaSubscription = {
  status: SubscriptionStatus
  planKey: PlanKey | null
  planLabel: string | null
  priceCents: number | null
  maxSpaces: number | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  canceledAt: string | null
  paymentMethod: string | null
  card: CardInfo | null
}

type StripeEnrichedData = {
  paymentMethod: string | null
  card: CardInfo | null
  currentPeriodEnd: string | null
}

async function fetchStripeData(stripeSubscriptionId: string): Promise<StripeEnrichedData> {
  try {
    const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
      expand: ['default_payment_method']
    })

    const rawPeriodEnd = sub.items.data[0]?.current_period_end
    const currentPeriodEnd = rawPeriodEnd
      ? new Date(rawPeriodEnd * 1000).toISOString()
      : null

    const pm = sub.default_payment_method
    if (!pm || typeof pm === 'string') {
      return { paymentMethod: null, card: null, currentPeriodEnd }
    }

    if (pm.type === 'card' && pm.card) {
      return {
        paymentMethod: 'Cartão de crédito',
        card: {
          brand: pm.card.brand ?? 'unknown',
          last4: pm.card.last4 ?? '****'
        },
        currentPeriodEnd
      }
    }

    return { paymentMethod: pm.type, card: null, currentPeriodEnd }
  } catch {
    return { paymentMethod: null, card: null, currentPeriodEnd: null }
  }
}

export async function getSubscription(arenaId: string): Promise<ArenaSubscription> {
  const supabase = getSupabaseAdmin()

  const { data } = await supabase
    .from('arena_subscriptions')
    .select(
      'plan_key, status, current_period_end, cancel_at_period_end, canceled_at, stripe_subscription_id, subscription_plans(label, price_cents, max_spaces)'
    )
    .eq('arena_id', arenaId)
    .maybeSingle()

  if (!data) {
    return {
      status: 'none',
      planKey: null,
      planLabel: null,
      priceCents: null,
      maxSpaces: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      paymentMethod: null,
      card: null
    }
  }

  const parsedKey = planKeySchema.safeParse(data.plan_key)

  // Dados do plano vêm do join com subscription_plans via plan_id FK.
  // Fallback para null caso o join não retorne (plan_id não preenchido ainda).
  const planJoin = Array.isArray(data.subscription_plans)
    ? data.subscription_plans[0]
    : data.subscription_plans

  const fallbackPlan =
    !planJoin && parsedKey.success ? await fetchPlanByKey(parsedKey.data) : null

  let stripeData: StripeEnrichedData = { paymentMethod: null, card: null, currentPeriodEnd: null }
  if (data.stripe_subscription_id) {
    stripeData = await fetchStripeData(data.stripe_subscription_id)
  }

  return {
    status: (data.status as SubscriptionStatus) ?? 'none',
    planKey: parsedKey.success ? parsedKey.data : null,
    planLabel: planJoin?.label ?? fallbackPlan?.label ?? null,
    priceCents: planJoin?.price_cents ?? fallbackPlan?.price_cents ?? null,
    maxSpaces: planJoin?.max_spaces ?? fallbackPlan?.max_spaces ?? null,
    currentPeriodEnd: data.current_period_end ?? stripeData.currentPeriodEnd,
    cancelAtPeriodEnd: data.cancel_at_period_end ?? false,
    canceledAt: data.canceled_at ?? null,
    paymentMethod: stripeData.paymentMethod,
    card: stripeData.card
  }
}
