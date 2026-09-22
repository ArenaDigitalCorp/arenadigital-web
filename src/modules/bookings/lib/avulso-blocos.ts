/**
 * Lógica de seleção múltipla para a reserva Avulsa — mesma experiência visual
 * da grade do mensalista (`mensalista-blocos.ts`), mas para uma **semana real**
 * em vez de uma recorrência: cada célula é uma data concreta, sem horizonte de
 * 3 meses nem pró-rata. Uma reserva avulsa continua sendo uma reserva avulsa —
 * isto só deixa o gestor marcar várias de uma vez, em quadras diferentes.
 *
 * Duplica (em vez de importar) as constantes de dia da semana de
 * `mensalista-blocos.ts`: o módulo não importa nada em tempo de execução de
 * propósito, para poder ser testado com `node --test` sem resolver alias de
 * path — mesma razão documentada lá.
 */

export const DIAS_SEMANA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const

export const DIAS_SEMANA_LONGO = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const

export function formatHora(hora: number): string {
  return `${String(hora).padStart(2, '0')}:00`
}

export type SlotStatusAvulso = 'free' | 'busy' | 'closed' | 'past'

export interface SlotInfoAvulso {
  status: SlotStatusAvulso
  /** Quem ocupa, quando `busy`. */
  occupantName?: string
}

export interface CourtDayConfig {
  day: string
  enabled: boolean
  startTime: string
  endTime: string
}

export interface CourtLike {
  id: string
  name: string
  day_config?: CourtDayConfig[] | null
}

export interface BookingLike {
  court_id: string
  start_time: string
  end_time: string
  status?: string | null
  athlete_name?: string | null
}

export interface BlocoAvulso {
  courtId: string
  /** `yyyy-MM-dd` da data concreta do bloco. */
  date: string
  /** Hora cheia de início, ex. 19. */
  from: number
  /** Hora cheia de fim (exclusiva no calendário), ex. 21. */
  to: number
  hours: number[]
}

export type SlotKeyAvulso = `${string}|${string}|${number}`

export function slotKeyAvulso(courtId: string, date: string, hora: number): SlotKeyAvulso {
  return `${courtId}|${date}|${hora}` as SlotKeyAvulso
}

export function parseSlotKeyAvulso(key: string): {
  courtId: string
  date: string
  hora: number
} {
  const [courtId, date, hora] = key.split('|')
  return { courtId, date, hora: Number(hora) }
}

/** Domingo da semana que contém `date` (00:00 local). */
export function inicioDaSemana(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() - d.getDay())
  return d
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Horas contíguas do mesmo espaço e data viram um bloco só — é assim que o
 * gestor pensa ("terça das 19 às 21") e é o que vira uma única reserva.
 */
export function agruparBlocosAvulso(keys: Iterable<string>): BlocoAvulso[] {
  const porCourtData = new Map<string, number[]>()

  for (const key of keys) {
    const { courtId, date, hora } = parseSlotKeyAvulso(key)
    const agrupador = `${courtId}|${date}`
    const lista = porCourtData.get(agrupador)
    if (lista) lista.push(hora)
    else porCourtData.set(agrupador, [hora])
  }

  const blocos: BlocoAvulso[] = []
  for (const [agrupador, horas] of porCourtData) {
    const [courtId, date] = agrupador.split('|')
    horas.sort((a, b) => a - b)

    let corrente: number[] = [horas[0]]
    for (let i = 1; i <= horas.length; i++) {
      if (horas[i] === corrente[corrente.length - 1] + 1) {
        corrente.push(horas[i])
        continue
      }
      blocos.push({
        courtId,
        date,
        from: corrente[0],
        to: corrente[corrente.length - 1] + 1,
        hours: [...corrente],
      })
      if (horas[i] !== undefined) corrente = [horas[i]]
    }
  }

  return blocos.sort(
    (a, b) => a.date.localeCompare(b.date) || a.from - b.from || a.courtId.localeCompare(b.courtId)
  )
}

function nomeDoDia(date: Date): string {
  return DIAS_SEMANA_LONGO[date.getDay()]
}

/** A quadra está aberta nessa hora, segundo o `day_config`? */
export function estaAbertoAvulso(court: CourtLike, date: Date, hora: number): boolean {
  const config = court.day_config?.find(
    (dia) => dia.day.toLowerCase() === nomeDoDia(date).toLowerCase()
  )
  if (!config || !config.enabled) return false

  const inicio = Number.parseInt(config.startTime.split(':')[0], 10)
  const fim = Number.parseInt(config.endTime.split(':')[0], 10)
  if (Number.isNaN(inicio) || Number.isNaN(fim)) return false

  // Fechamento após a meia-noite (ex. 18h–02h) vira um intervalo circular.
  return inicio < fim ? hora >= inicio && hora < fim : hora >= inicio || hora < fim
}

function ocupaIntervalo(booking: BookingLike, inicio: Date, fim: Date): boolean {
  if (booking.status === 'cancelled') return false
  const bookingInicio = new Date(booking.start_time)
  const bookingFim = new Date(booking.end_time)
  return bookingInicio < fim && bookingFim > inicio
}

export interface AvaliarSlotAvulsoParams {
  court: CourtLike
  date: Date
  hora: number
  bookingsPorCourt: Map<string, BookingLike[]>
  agora: Date
}

/** Estado de uma célula da grade — uma data concreta, sem horizonte nenhum. */
export function avaliarSlotAvulso({
  court,
  date,
  hora,
  bookingsPorCourt,
  agora,
}: AvaliarSlotAvulsoParams): SlotInfoAvulso {
  if (!estaAbertoAvulso(court, date, hora)) return { status: 'closed' }

  const inicio = new Date(date)
  inicio.setHours(hora, 0, 0, 0)
  const fim = new Date(date)
  fim.setHours(hora + 1, 0, 0, 0)

  if (fim <= agora) return { status: 'past' }

  const bookings = bookingsPorCourt.get(court.id) ?? []
  const conflito = bookings.find((booking) => ocupaIntervalo(booking, inicio, fim))
  if (conflito) {
    return { status: 'busy', occupantName: conflito.athlete_name ?? 'Reservado' }
  }

  return { status: 'free' }
}

export function podeSelecionarAvulso(status: SlotStatusAvulso): boolean {
  return status === 'free'
}

export interface ResumoBlocoAvulso extends BlocoAvulso {
  /** Preço sugerido pela tabela do espaço — o gestor pode sobrescrever. */
  valorSugerido: number
  /** Valor que realmente vai ser cobrado (sugerido, ou o que o gestor editou). */
  valor: number
}

/** Intervalo ISO de um bloco, pronto para cotar preço ou criar a reserva. */
export function intervaloDoBlocoAvulso(bloco: BlocoAvulso): { startISO: string; endISO: string } {
  const base = fromDateKey(bloco.date)
  const inicio = new Date(base)
  inicio.setHours(bloco.from, 0, 0, 0)
  const fim = new Date(base)
  fim.setHours(bloco.to, 0, 0, 0)
  return { startISO: inicio.toISOString(), endISO: fim.toISOString() }
}

/** Chave estável de um bloco — usada para casar valor editado/cotado por posição. */
export function blocoAvulsoId(bloco: Pick<BlocoAvulso, 'courtId' | 'date' | 'from'>): string {
  return `${bloco.courtId}|${bloco.date}|${bloco.from}`
}
