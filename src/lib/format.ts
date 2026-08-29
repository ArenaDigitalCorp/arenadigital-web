import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

/** Formats a number as Brazilian Real, e.g. `formatCurrency(60)` → "R$ 60,00". */
export function formatCurrency(value: number | null | undefined): string {
  return brl.format(Number(value ?? 0))
}

/**
 * Formats a competência (a `YYYY-MM` string or an ISO date on the 1st of the
 * month) as "agosto de 2026".
 */
export function formatCompetencia(competencia: string): string {
  const iso = competencia.length === 7 ? `${competencia}-01` : competencia
  return format(parseISO(iso), "MMMM 'de' yyyy", { locale: ptBR })
}

/** Formats a competência as "Ago/2026". */
export function formatCompetenciaShort(competencia: string): string {
  const iso = competencia.length === 7 ? `${competencia}-01` : competencia
  const label = format(parseISO(iso), 'MMM/yyyy', { locale: ptBR })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** `2026-08-15` → `15/08/2026`. Returns "—" for empty input. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return format(parseISO(value), 'dd/MM/yyyy')
}

/** `2026-08` string for the given date (defaults to now). */
export function toCompetencia(date: Date = new Date()): string {
  return format(date, 'yyyy-MM')
}
