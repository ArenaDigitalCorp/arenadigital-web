'use client'

import { useState } from 'react'
import type { PlanKey } from '@/modules/payments/plans'

type Props = {
  arenaId: string
  planKey: PlanKey
  onSuccess: () => void
  onError: (message: string) => void
  onCancel?: () => void
  submitLabel?: string
}

type FormState = {
  cardHolderName: string
  cardNumber: string
  expiry: string
  cvv: string
  cpfCnpj: string
}

const INITIAL_STATE: FormState = {
  cardHolderName: '',
  cardNumber: '',
  expiry: '',
  cvv: '',
  cpfCnpj: ''
}

function parseExpiry(expiry: string): { month: string; year: string } | null {
  const cleaned = expiry.replace(/\D/g, '')
  if (cleaned.length !== 4 && cleaned.length !== 6) return null
  const month = cleaned.slice(0, 2)
  const yearPart = cleaned.slice(2)
  const year = yearPart.length === 2 ? `20${yearPart}` : yearPart
  if (Number(month) < 1 || Number(month) > 12) return null
  return { month, year }
}

export function AsaasCardForm({
  arenaId,
  planKey,
  onSuccess,
  onError,
  onCancel,
  submitLabel = 'Salvar'
}: Props) {
  const [form, setForm] = useState<FormState>(INITIAL_STATE)
  const [loading, setLoading] = useState(false)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const expiry = parseExpiry(form.expiry)
      if (!expiry) {
        onError('Validade do cartão inválida. Use o formato MM/AA.')
        return
      }

      const tokenizeRes = await fetch('/api/payments/tokenize-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          arenaId,
          card: {
            holderName: form.cardHolderName,
            number: form.cardNumber.replace(/\s/g, ''),
            expiryMonth: expiry.month,
            expiryYear: expiry.year,
            cvv: form.cvv
          },
          cpfCnpj: form.cpfCnpj
        })
      })

      const tokenData = await tokenizeRes.json()
      if (!tokenizeRes.ok) {
        onError(tokenData.error ?? 'Falha ao tokenizar o cartão.')
        return
      }

      const subscribeRes = await fetch('/api/payments/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          arenaId,
          planKey,
          paymentMethodId: tokenData.token
        })
      })

      const subscribeData = await subscribeRes.json()
      if (!subscribeRes.ok) {
        onError(subscribeData.error ?? 'Falha ao ativar a assinatura.')
        return
      }

      if (subscribeData.status === 'active') {
        onSuccess()
        return
      }

      if (subscribeData.status === 'requires_action') {
        onError(
          'O pagamento exige autenticação adicional. Tente novamente em alguns instantes.'
        )
        return
      }

      onError(subscribeData.message ?? 'Não foi possível ativar a assinatura.')
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <fieldset className="space-y-4">
        <Field
          label="Número do cartão"
          value={form.cardNumber}
          onChange={(v) => update('cardNumber', v)}
          inputMode="numeric"
          maxLength={19}
          placeholder="Insira o número do cartão"
          required
        />

        <Field
          label="Nome impresso no cartão"
          value={form.cardHolderName}
          onChange={(v) => update('cardHolderName', v)}
          placeholder="Insira o nome impresso no cartão"
          required
        />

        <Field
          label="CPF/CNPJ"
          value={form.cpfCnpj}
          onChange={(v) => update('cpfCnpj', v)}
          inputMode="numeric"
          placeholder="Insira o CPF ou CNPJ titular do cartão"
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Data de validade"
            value={form.expiry}
            onChange={(v) => update('expiry', v)}
            inputMode="numeric"
            maxLength={5}
            placeholder="00/00"
            required
          />
          <Field
            label="CVV"
            value={form.cvv}
            onChange={(v) => update('cvv', v)}
            inputMode="numeric"
            maxLength={4}
            placeholder="000"
            required
          />
        </div>
      </fieldset>

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
          disabled={loading}
          className="h-12 flex-1 rounded-xl bg-arena-button text-sm font-semibold text-white transition-colors hover:bg-arena-button-hover disabled:opacity-50"
        >
          {loading ? 'Processando...' : submitLabel}
        </button>
      </div>
    </form>
  )
}

type FieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  inputMode?: 'text' | 'numeric' | 'tel' | 'email'
  maxLength?: number
  placeholder?: string
  required?: boolean
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  inputMode,
  maxLength,
  placeholder,
  required
}: FieldProps) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-normal text-[#64748B]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={inputMode}
        maxLength={maxLength}
        placeholder={placeholder}
        required={required}
        className="h-12 w-full rounded-xl border border-[#D1D5DB] bg-white px-4 text-sm text-arena-navy-800 shadow-none placeholder:text-[#94A3B8] focus:border-arena-button focus:outline-none focus:ring-1 focus:ring-arena-button"
      />
    </label>
  )
}
