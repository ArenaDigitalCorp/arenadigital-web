import { redirect } from 'next/navigation'
import { assertArenaSubscriptionAccess } from '@/lib/server-auth'
import { fetchAllActivePlans } from '@/modules/stripe/repositories/subscription-plans.repository'
import {
  EARLY_ACCESS_PLAN_KEY,
  isPlanSelectionEnabled,
  planKeySchema
} from '@/modules/stripe/stripe-plans'
import { getPaymentHistory } from '@/modules/stripe/usecases/get-payment-history.usecase'
import { getSubscription } from '@/modules/stripe/usecases/get-subscription.usecase'
import { SubscriptionPageClient } from './SubscriptionPageClient'

function normalizeFeatures(features: unknown) {
  if (!Array.isArray(features)) return []

  return features.filter((feature): feature is string => typeof feature === 'string')
}

export default async function SubscriptionArenaPage({
  params
}: {
  params: Promise<{ arenaId: string }>
}) {
  const { arenaId } = await params

  try {
    await assertArenaSubscriptionAccess(arenaId)
  } catch {
    redirect('/dashboard/settings/arenas')
  }

  const [subscription, paymentHistory, plans] = await Promise.all([
    getSubscription(arenaId),
    getPaymentHistory(arenaId),
    fetchAllActivePlans()
  ])

  const planSelectionEnabled = isPlanSelectionEnabled()

  return (
    <SubscriptionPageClient
      arenaId={arenaId}
      initialSubscription={subscription}
      initialPaymentHistory={paymentHistory}
      planSelectionEnabled={planSelectionEnabled}
      plans={plans.flatMap((plan) => {
        const parsedPlanKey = planKeySchema.safeParse(plan.key)
        if (!parsedPlanKey.success) return []
        if (!planSelectionEnabled && parsedPlanKey.data !== EARLY_ACCESS_PLAN_KEY) return []

        return [
          {
            key: parsedPlanKey.data,
            label: plan.label,
            priceCents: plan.price_cents,
            maxSpaces: plan.max_spaces,
            features: normalizeFeatures(plan.features)
          }
        ]
      })}
    />
  )
}
