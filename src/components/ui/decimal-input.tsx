'use client'

import type { ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { formatDecimalInput, parseBrazilianDecimal } from '@/lib/format'

/** Mantém o texto durante a edição e padroniza somente um valor completo ao sair. */
export function DecimalInput({ onBlur, onChange, ...props }: ComponentProps<typeof Input>) {
  return <Input {...props} type="text" inputMode="decimal" onChange={onChange} onBlur={event => {
    const parsed = parseBrazilianDecimal(event.currentTarget.value)
    if (parsed !== null) {
      event.currentTarget.value = formatDecimalInput(parsed)
      onChange?.(event)
    }
    onBlur?.(event)
  }} />
}
