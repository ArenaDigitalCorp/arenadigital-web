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

/**
 * `transactions.launch_date` exatamente à meia-noite UTC é um lançamento "só
 * data" (mensalidade, reserva, lançamento manual): vale o dia UTC, não o dia
 * anterior que a conversão para Brasília daria. Qualquer outro valor é um
 * instante (comanda, rotativo). Mesma regra de get_arena_finance_* no banco.
 */
export function lancamentoSoData(iso: string | null | undefined): boolean {
  if (!iso) return false
  const d = new Date(iso)
  return (
    !Number.isNaN(d.getTime()) &&
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  )
}

/** Data de um lançamento do caixa em `dd/MM/yyyy`, respeitando lançamentos "só data". */
export function formatLaunchDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  if (lancamentoSoData(iso)) {
    const [ano, mes, dia] = new Date(iso).toISOString().slice(0, 10).split('-')
    return `${dia}/${mes}/${ano}`
  }
  return new Date(iso).toLocaleDateString('pt-BR')
}
