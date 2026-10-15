'use client'

import { useRef, type ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { maskCpf, maskCnpj, maskCpfCnpj, maskCep, maskPhone } from '@/lib/brasil-document'
import { maskEdit } from '@/lib/masked-input-edit'

const masks = { cpf: maskCpf, cnpj: maskCnpj, cpfCnpj: maskCpfCnpj, cep: maskCep, phone: maskPhone }
type MaskedInputProps = ComponentProps<typeof Input> & { mask: keyof typeof masks }

/** Controlled input with progressive formatting, caret preservation and paste support. */
export function MaskedInput({ mask, onChange, onKeyDown, onCompositionStart, onCompositionEnd, ...props }: MaskedInputProps) {
  const previous = useRef<{ value: string; start: number; end: number; key: string } | null>(null)
  const composing = useRef(false)
  const displayValue = props.value == null ? undefined : masks[mask](String(props.value))
  const displayDefault = props.defaultValue == null ? undefined : masks[mask](String(props.defaultValue))
  return <Input {...props} value={displayValue} defaultValue={displayDefault}
    onCompositionStart={event => { composing.current = true; onCompositionStart?.(event) }}
    onCompositionEnd={event => { composing.current = false; onCompositionEnd?.(event) }}
    onKeyDown={event => {
      const input = event.currentTarget
      previous.current = { value: input.value, start: input.selectionStart ?? 0, end: input.selectionEnd ?? 0, key: event.key }
      onKeyDown?.(event)
    }}
    onChange={event => {
      if (composing.current) { onChange?.(event); return }
      const input = event.currentTarget
      const edited = maskEdit(input.value, input.selectionStart ?? input.value.length, masks[mask], previous.current)
      previous.current = null
      input.value = edited.value
      onChange?.(event)
      // React applies the controlled value after the handler; restore selection afterwards.
      requestAnimationFrame(() => {
        if (input.isConnected && document.activeElement === input && input.value === edited.value) {
          input.setSelectionRange(edited.caret, edited.caret)
        }
      })
    }}
  />
}
