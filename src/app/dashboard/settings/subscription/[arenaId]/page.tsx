import { redirect } from 'next/navigation'
import { assertArenaSubscriptionAccess } from '@/lib/server-auth'
import { fetchAllActivePlans } from '@/modules/payments/repositories/subscription-plans.repository'
import {
  EARLY_ACCESS_PLAN_KEY,
  isPlanSelectionEnabled,
  planKeySchema
} from '@/modules/payments/plans'
import { getArenaBillingAddress } from '@/modules/arenas/usecases/get-arena-billing-address.usecase'
import { getPaymentHistory } from '@/modules/payments/usecases/get-payment-history.usecase'
import { getSubscription } from '@/modules/payments/usecases/get-subscription.usecase'
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

  const [subscription, paymentHistory, plans, billingAddress] = await Promise.all([
    getSubscription(arenaId),
    getPaymentHistory(arenaId),
    fetchAllActivePlans(),
    getArenaBillingAddress(arenaId),
  ])

  const planSelectionEnabled = isPlanSelectionEnabled()

  return (
    <SubscriptionPageClient
      arenaId={arenaId}
      initialSubscription={subscription}
      initialPaymentHistory={paymentHistory}
      billingAddress={billingAddress}
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
