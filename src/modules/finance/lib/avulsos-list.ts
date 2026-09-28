import {
  resumoRateio,
  round2,
  sortCobrancas,
  toBookingCobranca,
  type BookingCobranca,
} from '@/modules/bookings/lib/booking-rateio'

export type AvulsoStatus = 'pendente' | 'pago' | 'cancelado'

/** Uma reserva avulsa na página Gestão Reservas → Avulsos. */
export type AvulsoReservaItem = {
  id: string
  start_time: string
  end_time: string
  status: AvulsoStatus
  athlete_name: string
  atleta: { id: string; nome_perfil: string; telefone: string | null } | null
  court: { id: string; name: string } | null
  sports: { id: string; name: string } | null
  /** Reserva com rateio: cada pessoa tem sua cobrança em `cobrancas`. */
  rateio: boolean
  /** Total a cobrar (soma das partes no rateio; valor da reserva sem rateio). */
  valor_total: number
  valor_pago: number
  restante: number
  cobrancas: BookingCobranca[]
}

type Embedded<T> = T | T[] | null | undefined

export type AvulsoBookingRow = {
  id: string
  start_time: string
  end_time: string
  price: number | string | null
  status: string | null
  athlete_name: string | null
  cobranca_por_participante: boolean | null
  atleta?: Embedded<{ id: string; nome_perfil: string; telefone: string | null }>
  court?: Embedded<{ id: string; name: string }>
  sports?: Embedded<{ id: string; name: string }>
  booking_cobrancas?: Record<string, unknown>[] | null
}

function one<T>(value: Embedded<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export function buildAvulsoItem(row: AvulsoBookingRow): AvulsoReservaItem {
  const atleta = one(row.atleta)
  const status: AvulsoStatus =
    row.status === 'cancelled' ? 'cancelado' : row.status === 'confirmed' ? 'pago' : 'pendente'
  const base = {
    id: row.id,
    start_time: row.start_time,
    end_time: row.end_time,
    status,
    athlete_name: atleta?.nome_perfil ?? row.athlete_name ?? 'Atleta',
    atleta,
    court: one(row.court),
    sports: one(row.sports),
  }

  if (row.cobranca_por_participante) {
    // O total do rateio vem das partes — em reservas antigas `price` guarda o
    // valor por pessoa, então não serve como total.
    const cobrancas = sortCobrancas((row.booking_cobrancas ?? []).map(toBookingCobranca))
    const resumo = resumoRateio(cobrancas)
    return {
      ...base,
      rateio: true,
      valor_total: resumo.devido,
      valor_pago: resumo.pago,
      restante: status === 'cancelado' ? 0 : resumo.restante,
      cobrancas,
    }
  }

  const total = round2(Number(row.price ?? 0))
  return {
    ...base,
    rateio: false,
    valor_total: total,
    valor_pago: status === 'pago' ? total : 0,
    restante: status === 'pendente' ? total : 0,
    cobrancas: [],
  }
}

export type AvulsosResumo = {
  pendentes: number
  aReceber: number
  pagas: number
  recebido: number
}

/** Cards do topo: reservas pendentes/pagas e dinheiro a receber/recebido (inclui parciais). */
export function resumoAvulsos(items: AvulsoReservaItem[]): AvulsosResumo {
  const ativos = items.filter((i) => i.status !== 'cancelado')
  return {
    pendentes: ativos.filter((i) => i.status === 'pendente').length,
    aReceber: round2(ativos.reduce((s, i) => s + i.restante, 0)),
    pagas: ativos.filter((i) => i.status === 'pago').length,
    recebido: round2(ativos.reduce((s, i) => s + i.valor_pago, 0)),
  }
}

/** Busca por responsável, espaço ou qualquer pessoa do rateio (inclusive sem cadastro). */
export function matchesAvulsoSearch(item: AvulsoReservaItem, search: string): boolean {
  const q = search.trim().toLocaleLowerCase('pt-BR')
  if (!q) return true
  const haystack = [
    item.athlete_name,
    item.atleta?.nome_perfil,
    item.court?.name,
    ...item.cobrancas.map((c) => c.nome),
  ]
  return haystack.some((v) => v?.toLocaleLowerCase('pt-BR').includes(q))
}
