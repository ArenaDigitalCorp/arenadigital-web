/**
 * Rateio de reserva avulsa — regras puras (sem I/O), compartilhadas pela página
 * Gestão Reservas → Avulsos, pelo cadastro da reserva e pelos relatórios.
 *
 * Cada pessoa do rateio é uma linha de `booking_cobrancas`: atleta cadastrado
 * ou pessoa sem cadastro (`atleta_id` nulo, identificada por `nome`).
 * `valor_devido` já inclui `valor_servicos` (só no responsável); a "parte" que o
 * gestor edita é a parcela da locação (`valor_devido - valor_servicos`).
 */

export type BookingCobrancaStatus = 'aberto' | 'parcial' | 'quitado'

export type BookingCobranca = {
  id: string
  atleta_id: string | null
  nome: string
  responsavel: boolean
  valor_devido: number
  valor_servicos: number
  valor_pago: number
  status: BookingCobrancaStatus
  pago_em: string | null
}

export type RateioResumo = {
  devido: number
  pago: number
  restante: number
  pessoas: number
  quitadas: number
}

/** Campos lidos de `booking_cobrancas` no embed do PostgREST. */
export const BOOKING_COBRANCAS_SELECT =
  'booking_cobrancas(id, atleta_id, nome, responsavel, valor_devido, valor_servicos, valor_pago, status, pago_em)'

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Normaliza a linha vinda do banco (numeric chega como string/number). */
export function toBookingCobranca(raw: Record<string, unknown>): BookingCobranca {
  const status = raw.status
  return {
    id: String(raw.id),
    atleta_id: typeof raw.atleta_id === 'string' ? raw.atleta_id : null,
    nome: String(raw.nome ?? ''),
    responsavel: Boolean(raw.responsavel),
    valor_devido: Number(raw.valor_devido ?? 0),
    valor_servicos: Number(raw.valor_servicos ?? 0),
    valor_pago: Number(raw.valor_pago ?? 0),
    status: status === 'quitado' || status === 'parcial' ? status : 'aberto',
    pago_em: typeof raw.pago_em === 'string' ? raw.pago_em : null,
  }
}

/** Responsável primeiro; depois cadastrados e sem cadastro, por nome. */
export function sortCobrancas(cobrancas: BookingCobranca[]): BookingCobranca[] {
  return [...cobrancas].sort((a, b) => {
    if (a.responsavel !== b.responsavel) return a.responsavel ? -1 : 1
    return a.nome.localeCompare(b.nome, 'pt-BR')
  })
}

export function restanteCobranca(c: Pick<BookingCobranca, 'valor_devido' | 'valor_pago'>): number {
  return round2(Math.max(0, c.valor_devido - c.valor_pago))
}

/** Parcela da locação (o que o gestor edita), sem os serviços do responsável. */
export function parteLocacao(c: Pick<BookingCobranca, 'valor_devido' | 'valor_servicos'>): number {
  return round2(Math.max(0, c.valor_devido - c.valor_servicos))
}

export function resumoRateio(cobrancas: BookingCobranca[]): RateioResumo {
  const devido = round2(cobrancas.reduce((s, c) => s + c.valor_devido, 0))
  const pago = round2(cobrancas.reduce((s, c) => s + c.valor_pago, 0))
  return {
    devido,
    pago,
    restante: round2(cobrancas.reduce((s, c) => s + restanteCobranca(c), 0)),
    pessoas: cobrancas.length,
    quitadas: cobrancas.filter((c) => c.status === 'quitado').length,
  }
}

/**
 * Divide `total` em `n` partes iguais em centavos. A sobra de centavos fica na
 * primeira parte (o responsável), para a soma bater exatamente com o total.
 */
export function dividirIgualmente(total: number, n: number): number[] {
  if (n <= 0) return []
  const cents = Math.max(0, Math.round(total * 100))
  const base = Math.floor(cents / n)
  const sobra = cents - base * n
  return Array.from({ length: n }, (_, i) => (base + (i === 0 ? sobra : 0)) / 100)
}

/** Diferença entre a soma das partes e a locação (positiva = partes somam a mais). */
export function diferencaRateio(partes: number[], locacao: number): number {
  return round2(partes.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0) - locacao)
}

/**
 * Valor de uma reserva com rateio no relatório de Pagamentos: enquanto a
 * reserva aguarda pagamento, o que ainda falta (considerando parciais);
 * depois, o total das partes.
 */
export function valorRateioNoRelatorio(
  bookingStatus: string | null | undefined,
  cobrancas: Pick<BookingCobranca, 'valor_devido' | 'valor_pago'>[]
): number {
  if (bookingStatus === 'reservado') {
    return round2(cobrancas.reduce((s, c) => s + restanteCobranca(c), 0))
  }
  return round2(cobrancas.reduce((s, c) => s + c.valor_devido, 0))
}

/** Quanto um atleta ainda deve no rateio de uma reserva (0 se não participa). */
export function restanteDoAtletaNoRateio(
  atletaId: string,
  cobrancas: Pick<BookingCobranca, 'atleta_id' | 'valor_devido' | 'valor_pago'>[]
): number {
  const minha = cobrancas.find((c) => c.atleta_id === atletaId)
  return minha ? restanteCobranca(minha) : 0
}

/**
 * Valor da locação de uma reserva com rateio. No modelo novo `price` é sempre a
 * soma das partes e `rental_price` a locação digitada. Reservas criadas antes do
 * rateio guardam o valor POR PESSOA em `price`/`rental_price` — aí `price` não
 * bate com a soma, e a locação real é a soma das partes (sem os serviços).
 */
export function locacaoDoRateio(
  booking: { price: number | string | null; rental_price: number | string | null },
  cobrancas: Pick<BookingCobranca, 'valor_devido' | 'valor_servicos'>[]
): number {
  const soma = round2(cobrancas.reduce((s, c) => s + c.valor_devido, 0))
  const servicos = round2(cobrancas.reduce((s, c) => s + c.valor_servicos, 0))
  const semServicos = round2(Math.max(0, soma - servicos))
  if (cobrancas.length === 0) return round2(Number(booking.rental_price ?? booking.price ?? 0))
  const legado = Math.abs(Number(booking.price ?? 0) - soma) > 0.005
  if (legado || booking.rental_price == null) return semServicos
  return round2(Number(booking.rental_price))
}
