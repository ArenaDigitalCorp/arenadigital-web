import { parseBrazilianDecimal } from '@/lib/format'

export type HourlyPriceDraft = { value: string; sourcePrice: number }

/** Um texto em edição só pertence ao preço que existia quando foi digitado. */
export function currentHourlyDraft(draft: HourlyPriceDraft | undefined, price: number): string | undefined {
  return draft && Object.is(draft.sourcePrice, price) ? draft.value : undefined
}

export function invalidHourlyDraft(draft: HourlyPriceDraft | undefined, price: number): boolean {
  const value = currentHourlyDraft(draft, price)
  if (value === undefined) return false
  const amount = parseBrazilianDecimal(value)
  return amount === null || amount < 0
}
