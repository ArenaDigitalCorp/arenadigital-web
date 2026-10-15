import { parseBrazilianDecimal } from '@/lib/format'

export function parsePositiveInteger(value: string): number | null {
  const text = value.trim()
  if (!/^\d+$/.test(text)) return null
  const parsed = Number(text)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

export function parseRotativoAmount(value: string): number | null {
  const parsed = parseBrazilianDecimal(value)
  return parsed !== null && parsed > 0 ? parsed : null
}

export function parseRotativoPackages(drafts: { quantidade: string; valor_reais: string }[]) {
  const packages: { quantidade: number; valor_reais: number }[] = []
  if (drafts.length === 0) return null
  for (const draft of drafts) {
    const quantity = parsePositiveInteger(draft.quantidade)
    const amount = parseBrazilianDecimal(draft.valor_reais)
    if (quantity === null || amount === null || amount < 0) return null
    packages.push({ quantidade: quantity, valor_reais: amount })
  }
  return packages
}
