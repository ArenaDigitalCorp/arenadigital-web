import { redirect } from 'next/navigation'
import { assertArenaSubscriptionAccess } from '@/lib/server-auth'
import { fetchSelectableActivePlans } from '@/modules/payments/repositories/subscription-plans.repository'
import {
  EARLY_ACCESS_PLAN_KEY,
  EXPERIMENTAL_PLAN_KEY,
  isPlanSelectionEnabled,
  userSelectablePlanKeySchema
} from '@/modules/payments/plans'
import { isPeriodExpired } from '@/modules/payments/subscription-rules'
import { getArenaBillingAddress } from '@/modules/arenas/usecases/get-arena-billing-address.usecase'
import { getPaymentHistory } from '@/modules/payments/usecases/get-payment-history.usecase'
import { getSubscription } from '@/modules/payments/usecases/get-subscription.usecase'
import { SubscriptionPageClient } from '@/modules/payments/components/SubscriptionPageClient'
import { getPaymentGateway } from '@/modules/payments/gateway'

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
    fetchSelectableActivePlans(),
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
      paymentProvider={getPaymentGateway().providerName}
      plans={plans.flatMap((plan) => {
        const parsedPlanKey = userSelectablePlanKeySchema.safeParse(plan.key)
        if (!parsedPlanKey.success) return []
        if (!planSelectionEnabled && parsedPlanKey.data !== EARLY_ACCESS_PLAN_KEY) return []
        if (
          parsedPlanKey.data === EXPERIMENTAL_PLAN_KEY &&
          subscription.planKey &&
          (subscription.planKey !== EXPERIMENTAL_PLAN_KEY ||
            isPeriodExpired(subscription.currentPeriodEnd))
        ) {
          return []
        }

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
