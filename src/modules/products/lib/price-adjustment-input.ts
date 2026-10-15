import { parseBrazilianDecimal } from '@/lib/format'
import type { PriceAdjustmentType } from '../types/product.types'

/** Percentages keep the precision accepted by the existing price calculation.
 * Monetary adjustments still use the BRL input contract; rounding of the final
 * product price belongs to computeAdjustedPrice/the existing database RPC. */
export function parsePriceAdjustmentInput(value: string, type: PriceAdjustmentType): number | null {
  if (type === 'fixed') return parseBrazilianDecimal(value)
  const raw = value.trim()
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(raw)) return null
  const parsed = Number(raw.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}
