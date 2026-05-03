'use client'

import { Elements } from '@stripe/react-stripe-js'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { AsaasCardForm } from './AsaasCardForm'
import { PaymentSetupForm } from './PaymentSetupForm'
import type { CardCollectionContext } from '@/modules/payments/gateway/payment-gateway.interface'
import type { PlanKey } from '@/modules/payments/plans'

let stripePromiseCache: Promise<Stripe | null> | null = null

function getStripePromise(): Promise<Stripe | null> {
  if (!stripePromiseCache) {
    stripePromiseCache = loadStripe(
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''
    )
  }
  return stripePromiseCache
}

type Props = {
  arenaId: string
  planKey: PlanKey
  cardCollection: CardCollectionContext
  onSuccess: () => void
  onError: (message: string) => void
  onCancel?: () => void
  submitLabel?: string
}

export function PaymentMethodCollector({
  arenaId,
  planKey,
  cardCollection,
  onSuccess,
  onError,
  onCancel,
  submitLabel
}: Props) {
  if (cardCollection.provider === 'stripe') {
    return (
      <Elements
        stripe={getStripePromise()}
        options={{
          clientSecret: cardCollection.clientSecret,
          appearance: {
            theme: 'stripe',
            variables: {
              colorPrimary: '#FF6B00',
              borderRadius: '12px',
              colorText: '#002B40',
              colorBackground: '#ffffff'
            }
          },
          locale: 'pt-BR'
        }}
      >
        <PaymentSetupForm
          arenaId={arenaId}
          planKey={planKey}
          onSuccess={onSuccess}
          onError={onError}
          onCancel={onCancel}
          submitLabel={submitLabel}
        />
      </Elements>
    )
  }

  return (
    <AsaasCardForm
      arenaId={arenaId}
      planKey={planKey}
      onSuccess={onSuccess}
      onError={onError}
      onCancel={onCancel}
      submitLabel={submitLabel}
    />
  )
}
