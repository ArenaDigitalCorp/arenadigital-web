import z from 'zod'

export const planKeySchema = z.enum(['starter', 'pro', 'max'])
export type PlanKey = z.infer<typeof planKeySchema>

export type StripePlan = {
  key: PlanKey
  label: string
  priceCents: number
  maxSpaces: number
  stripePriceId: string
}

const stripePriceIdsByPlanKey: Record<PlanKey, string> = {
  starter: process.env.STRIPE_PRICE_START ?? '',
  pro: process.env.STRIPE_PRICE_PRO ?? '',
  max: process.env.STRIPE_PRICE_MAX ?? '',
}

export const STRIPE_PLANS: StripePlan[] = [
  {
    key: 'starter',
    label: 'Arena START',
    priceCents: 24900,
    maxSpaces: 5,
    stripePriceId: stripePriceIdsByPlanKey.starter
  },
  {
    key: 'pro',
    label: 'Arena PRO',
    priceCents: 54900,
    maxSpaces: 15,
    stripePriceId: stripePriceIdsByPlanKey.pro
  },
  {
    key: 'max',
    label: 'Arena MAX',
    priceCents: 94900,
    maxSpaces: 30,
    stripePriceId: stripePriceIdsByPlanKey.max
  }
]

export function getStripePlanByKey(key: PlanKey): StripePlan | undefined {
  return STRIPE_PLANS.find((p) => p.key === key)
}

export function getStripePlansForHttp() {
  return STRIPE_PLANS.map(({ key, label, priceCents, maxSpaces }) => ({
    key,
    label,
    priceCents,
    maxSpaces
  }))
}
