'use client'

import { useState, type ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { formatDecimalInput, parseBrazilianDecimal } from '@/lib/format'

/** Mantém o texto durante a edição e padroniza somente um valor completo ao sair. */
export function DecimalInput({ onBlur, onChange, ...props }: ComponentProps<typeof Input>) {
  const [presentation, setPresentation] = useState<{ source: string; value: string } | null>(null)
  const source = props.value == null ? undefined : String(props.value)
  const value = source !== undefined && presentation?.source === source ? presentation.value : props.value
  return <Input {...props} value={value} type="text" inputMode="decimal" onChange={event => {
    setPresentation(null)
    onChange?.(event)
  }} onBlur={event => {
    const parsed = parseBrazilianDecimal(event.currentTarget.value)
    if (parsed !== null) {
      const formatted = formatDecimalInput(parsed)
      // Formatting is presentation, not a user edit. Calling onChange here
      // marks automatic prices as manual and stops subsequent recalculation.
      if (source === undefined) event.currentTarget.value = formatted
      else setPresentation({ source, value: formatted })
    }
    onBlur?.(event)
  }} />
}
