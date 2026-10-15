import { z } from 'zod'
import { parseBrazilianDecimal } from '@/lib/format'

/** Preserve numeric payloads and complete legacy numeric strings, never coerce
 * null/boolean/empty input into a financial value. Bounds belong to the caller. */
export function decimalInput(schema: z.ZodNumber) {
  return z.preprocess(value =>
    typeof value === 'string' || typeof value === 'number' ? parseBrazilianDecimal(value) : undefined,
  schema)
}

export function integerInput(schema: z.ZodNumber) {
  return z.preprocess(value => {
    if (typeof value === 'number') return value
    return typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value.trim()) : undefined
  }, schema)
}
