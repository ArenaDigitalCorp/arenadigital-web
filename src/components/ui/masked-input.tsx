'use client'

import { useRef, useState, type ChangeEvent, type ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { maskCpf, maskCnpj, maskCpfCnpj, maskCep, maskPhone } from '@/lib/brasil-document'
import { maskEdit } from '@/lib/masked-input-edit'

const masks = { cpf: maskCpf, cnpj: maskCnpj, cpfCnpj: maskCpfCnpj, cep: maskCep, phone: maskPhone }
type MaskedInputProps = ComponentProps<typeof Input> & { mask: keyof typeof masks }

/** Controlled input with progressive formatting, caret preservation and paste support. */
export function MaskedInput({ mask, onChange, onKeyDown, onCompositionStart, onCompositionEnd, ...props }: MaskedInputProps) {
  const previous = useRef<{ value: string; start: number; end: number; key: string } | null>(null)
  const composing = useRef(false)
  const compositionNotifiedValue = useRef('')
  const [isComposing, setIsComposing] = useState(false)
  const displayValue = props.value == null ? undefined : isComposing ? String(props.value) : masks[mask](String(props.value))
  const displayDefault = props.defaultValue == null ? undefined : masks[mask](String(props.defaultValue))
  const restoreSelection = (input: HTMLInputElement, edited: { value: string; caret: number }) => {
    requestAnimationFrame(() => {
      if (input.isConnected && document.activeElement === input && input.value === edited.value) {
        input.setSelectionRange(edited.caret, edited.caret)
      }
    })
  }
  return <Input {...props} value={displayValue} defaultValue={displayDefault}
    onCompositionStart={event => {
      composing.current = true
      previous.current = null
      compositionNotifiedValue.current = event.currentTarget.value
      setIsComposing(true)
      onCompositionStart?.(event)
    }}
    onCompositionEnd={event => {
      composing.current = false
      previous.current = null
      setIsComposing(false)
      const input = event.currentTarget
      const edited = maskEdit(input.value, input.selectionStart ?? input.value.length, masks[mask])
      input.value = edited.value
      if (compositionNotifiedValue.current !== edited.value) {
        const change: ChangeEvent<HTMLInputElement> = {
          ...event, type: 'change', target: input, currentTarget: input,
          preventDefault: () => event.preventDefault(), stopPropagation: () => event.stopPropagation(),
          isDefaultPrevented: () => event.isDefaultPrevented(), isPropagationStopped: () => event.isPropagationStopped(),
          persist: () => event.persist(),
        }
        onChange?.(change)
      }
      onCompositionEnd?.(event)
      restoreSelection(input, edited)
    }}
    onKeyDown={event => {
      const input = event.currentTarget
      previous.current = { value: input.value, start: input.selectionStart ?? 0, end: input.selectionEnd ?? 0, key: event.key }
      onKeyDown?.(event)
    }}
    onChange={event => {
      if (composing.current) {
        compositionNotifiedValue.current = event.currentTarget.value
        previous.current = null
        onChange?.(event)
        return
      }
      const input = event.currentTarget
      const edited = maskEdit(input.value, input.selectionStart ?? input.value.length, masks[mask], previous.current)
      previous.current = null
      input.value = edited.value
      onChange?.(event)
      // React applies the controlled value after the handler; restore selection afterwards.
      restoreSelection(input, edited)
    }}
  />
}
