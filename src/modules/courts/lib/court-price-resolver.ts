import type { CourtPriceDay } from '@/modules/courts/types/price-table.types'

/**
 * Porta em TS de `public.resolve_court_price` (arenadigital-db). Mesma
 * semântica, para que grade, modal e banco não divirjam:
 *
 *  - casa a janela do dia testando ontem e hoje (funcionamento que cruza a
 *    meia-noite);
 *  - preço de um instante = faixa de exceção que o cobre, senão `basePrice`;
 *  - `hourly` soma o preço de cada hora (última fração rateada);
 *  - `unique` devolve o valor fixo da faixa que cobre o início;
 *  - fora da grade devolve 0 (sugestão neutra).
 *
 * As datas são wall-clock local — o mesmo que o banco obtém com
 * `AT TIME ZONE 'America/Sao_Paulo'`.
 */

export type CourtBookingType = 'hourly' | 'unique'

const MS_PER_HOUR = 3_600_000

export function parseHHMM(value: string): number {
  const [h, m] = (value || '00:00').split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function atMidnight(date: Date): Date {
  const out = new Date(date)
  out.setHours(0, 0, 0, 0)
  return out
}

function addDays(date: Date, amount: number): Date {
  const out = new Date(date)
  out.setDate(out.getDate() + amount)
  return out
}

/** Meia-noite de `base` + `hhmm`. */
function withTime(base: Date, hhmm: string): Date {
  const out = atMidnight(base)
  out.setMinutes(parseHHMM(hhmm))
  return out
}

export interface MatchedPriceDay {
  day: CourtPriceDay
  /** Dia em que a janela de funcionamento começou. */
  baseDate: Date
  windowStart: Date
  windowEnd: Date
}

function windowFor(day: CourtPriceDay, baseDate: Date) {
  const windowStart = withTime(baseDate, day.startTime)
  const crossesMidnight = parseHHMM(day.endTime) <= parseHHMM(day.startTime)
  const windowEnd = withTime(
    crossesMidnight ? addDays(baseDate, 1) : baseDate,
    day.endTime
  )
  return { windowStart, windowEnd }
}

/** Janela habilitada que contém todo o intervalo `[start, end]`. */
export function matchPriceDay(
  days: CourtPriceDay[] | null | undefined,
  start: Date,
  end: Date
): MatchedPriceDay | null {
  if (!days || days.length === 0) return null
  for (const offset of [-1, 0]) {
    const baseDate = addDays(atMidnight(start), offset)
    const day = days.find((d) => d.diaSemana === baseDate.getDay() && d.enabled)
    if (!day) continue
    const { windowStart, windowEnd } = windowFor(day, baseDate)
    if (start >= windowStart && end <= windowEnd) {
      return { day, baseDate, windowStart, windowEnd }
    }
  }
  return null
}

/** Janela habilitada que contém o instante `at` (`[start, end)`). */
export function matchPriceDayAt(
  days: CourtPriceDay[] | null | undefined,
  at: Date
): MatchedPriceDay | null {
  if (!days || days.length === 0) return null
  for (const offset of [-1, 0]) {
    const baseDate = addDays(atMidnight(at), offset)
    const day = days.find((d) => d.diaSemana === baseDate.getDay() && d.enabled)
    if (!day) continue
    const { windowStart, windowEnd } = windowFor(day, baseDate)
    if (at >= windowStart && at < windowEnd) {
      return { day, baseDate, windowStart, windowEnd }
    }
  }
  return null
}

/** Preço de um instante dentro de uma janela já casada. */
export function priceAtInstant(match: MatchedPriceDay, at: Date): number {
  const { day, baseDate } = match
  const dayStart = parseHHMM(day.startTime)

  for (const band of day.bands) {
    const bandStartMin = parseHHMM(band.start)
    const bandEndMin = parseHHMM(band.end)

    let bandStart = withTime(baseDate, band.start)
    if (bandStartMin < dayStart) bandStart = addDays(bandStart, 1)

    let bandEnd = withTime(bandStart, band.end)
    if (bandEndMin <= bandStartMin || bandEnd <= bandStart) {
      bandEnd = addDays(bandEnd, 1)
    }

    if (at >= bandStart && at < bandEnd) return Number(band.price) || 0
  }

  return Number(day.basePrice) || 0
}

/**
 * Preço do slot (uma hora da grade). `null` quando nenhum dia habilitado cobre
 * o instante — o chamador decide o fallback.
 */
export function resolveSlotPrice(
  days: CourtPriceDay[] | null | undefined,
  at: Date
): number | null {
  const match = matchPriceDayAt(days, at)
  if (!match) return null
  return priceAtInstant(match, at)
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** Sugestão de valor para o intervalo. Ver `resolve_court_price` no banco. */
export function resolveCourtPriceSuggestion(
  days: CourtPriceDay[] | null | undefined,
  bookingType: CourtBookingType,
  start: Date,
  end: Date
): number {
  if (!(start instanceof Date) || !(end instanceof Date)) return 0
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  if (end.getTime() <= start.getTime()) return 0

  const match = matchPriceDay(days, start, end)
  if (!match) return 0

  if (bookingType === 'unique') {
    return round2(priceAtInstant(match, start))
  }

  let total = 0
  let cursor = new Date(start)
  while (cursor.getTime() < end.getTime()) {
    const hours = Math.min(1, (end.getTime() - cursor.getTime()) / MS_PER_HOUR)
    total += priceAtInstant(match, cursor) * hours
    cursor = new Date(cursor.getTime() + MS_PER_HOUR)
  }
  return round2(total)
}
