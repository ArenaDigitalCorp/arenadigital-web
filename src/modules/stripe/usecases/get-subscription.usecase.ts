import { stripe } from '@/lib/stripe.client'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { getStripePlanByKey, planKeySchema, type PlanKey } from '@/modules/stripe/stripe-plans'

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

async function fetchCardInfo(stripeSubscriptionId: string): Promise<{ paymentMethod: string | null; card: CardInfo | null }> {
  try {
    const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
      expand: ['default_payment_method']
    })

    const pm = sub.default_payment_method
    if (!pm || typeof pm === 'string') return { paymentMethod: null, card: null }

    if (pm.type === 'card' && pm.card) {
      return {
        paymentMethod: 'Cartão de crédito',
        card: {
          brand: pm.card.brand ?? 'unknown',
          last4: pm.card.last4 ?? '****'
        }
      }
    }

    return { paymentMethod: pm.type, card: null }
  } catch {
    return { paymentMethod: null, card: null }
  }
}

export async function getSubscription(arenaId: string): Promise<ArenaSubscription> {
  const supabase = getSupabaseAdmin()

  const { data } = await supabase
    .from('arena_subscriptions')
    .select(
      'plan_key, status, current_period_end, cancel_at_period_end, canceled_at, stripe_subscription_id'
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
  const plan = parsedKey.success ? getStripePlanByKey(parsedKey.data) : undefined

  let cardData: { paymentMethod: string | null; card: CardInfo | null } = { paymentMethod: null, card: null }
  if (data.stripe_subscription_id) {
    cardData = await fetchCardInfo(data.stripe_subscription_id)
  }

  return {
    status: (data.status as SubscriptionStatus) ?? 'none',
    planKey: parsedKey.success ? parsedKey.data : null,
    planLabel: plan?.label ?? null,
    priceCents: plan?.priceCents ?? null,
    maxSpaces: plan?.maxSpaces ?? null,
    currentPeriodEnd: data.current_period_end ?? null,
    cancelAtPeriodEnd: data.cancel_at_period_end ?? false,
    canceledAt: data.canceled_at ?? null,
    paymentMethod: cardData.paymentMethod,
    card: cardData.card
  }
}
