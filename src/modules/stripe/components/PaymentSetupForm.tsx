'use client'

import {
  PaymentElement,
  useElements,
  useStripe
} from '@stripe/react-stripe-js'
import { useState } from 'react'

type Props = {
  arenaId: string
  onSuccess: () => void
  onError: (message: string) => void
}

export function PaymentSetupForm({ arenaId, onSuccess, onError }: Props) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) return

    setLoading(true)

    try {
      const { setupIntent, error: setupError } = await stripe.confirmSetup({
        elements,
        redirect: 'if_required'
      })

      if (setupError) {
        onError(setupError.message ?? 'Failed to save payment method.')
        return
      }

      if (!setupIntent || setupIntent.status !== 'succeeded') {
        onError('Payment method setup did not complete. Please try again.')
        return
      }

      const paymentMethodId =
        typeof setupIntent.payment_method === 'string'
          ? setupIntent.payment_method
          : setupIntent.payment_method?.id

      if (!paymentMethodId) {
        onError('Could not retrieve payment method. Please try again.')
        return
      }

      const res = await fetch('/api/stripe/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arenaId, paymentMethodId })
      })

      const data = await res.json()

      if (!res.ok) {
        onError(data.error ?? 'Failed to activate subscription.')
        return
      }

      if (data.status === 'active') {
        onSuccess()
        return
      }

      if (data.status === 'requires_action' && data.clientSecret) {
        const { error: actionError } = await stripe.confirmCardPayment(data.clientSecret)

        if (actionError) {
          onError(actionError.message ?? 'Authentication failed.')
          return
        }

        onSuccess()
        return
      }

      onError(data.message ?? 'Subscription could not be activated.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || !elements || loading}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {loading ? 'Processando...' : 'Ativar assinatura'}
      </button>
    </form>
  )
}
