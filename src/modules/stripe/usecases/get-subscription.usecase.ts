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

export type ArenaSubscription = {
  status: SubscriptionStatus
  planKey: PlanKey | null
  planLabel: string | null
  priceCents: number | null
  maxSpaces: number | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  canceledAt: string | null
}

export async function getSubscription(arenaId: string): Promise<ArenaSubscription> {
  const supabase = getSupabaseAdmin()

  const { data } = await supabase
    .from('arena_subscriptions')
    .select(
      'plan_key, status, current_period_end, cancel_at_period_end, canceled_at'
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
      canceledAt: null
    }
  }

  const parsedKey = planKeySchema.safeParse(data.plan_key)
  const plan = parsedKey.success ? getStripePlanByKey(parsedKey.data) : undefined

  return {
    status: (data.status as SubscriptionStatus) ?? 'none',
    planKey: parsedKey.success ? parsedKey.data : null,
    planLabel: plan?.label ?? null,
    priceCents: plan?.priceCents ?? null,
    maxSpaces: plan?.maxSpaces ?? null,
    currentPeriodEnd: data.current_period_end ?? null,
    cancelAtPeriodEnd: data.cancel_at_period_end ?? false,
    canceledAt: data.canceled_at ?? null
  }
}
