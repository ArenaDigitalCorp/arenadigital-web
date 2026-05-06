'use client'

import {
  PaymentElement,
  useElements,
  useStripe
} from '@stripe/react-stripe-js'
import { useState } from 'react'

type Props = {
  arenaId: string
  planKey: 'starter' | 'pro' | 'max'
  onSuccess: () => void
  onError: (message: string) => void
  onCancel?: () => void
  submitLabel?: string
}

export function PaymentSetupForm({ arenaId, planKey, onSuccess, onError, onCancel, submitLabel = 'Salvar' }: Props) {
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

      const res = await fetch('/api/payments/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arenaId, planKey, paymentMethodId })
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="rounded-xl border border-[#D1D5DB] bg-white p-4">
        <PaymentElement />
      </div>
      <div className="flex gap-4 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="h-12 flex-1 rounded-xl border border-arena-navy-800 bg-white text-sm font-semibold text-arena-navy-800 transition-colors hover:bg-arena-navy-800/5 disabled:opacity-50"
          >
            Fechar
          </button>
        )}
        <button
          type="submit"
          disabled={!stripe || !elements || loading}
          className="h-12 flex-1 rounded-xl bg-arena-button text-sm font-semibold text-white transition-colors hover:bg-arena-button-hover disabled:opacity-50"
        >
          {loading ? 'Processando...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
