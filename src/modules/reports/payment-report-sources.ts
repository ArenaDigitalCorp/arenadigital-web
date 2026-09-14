import type { PaymentStatusFilters } from '@/modules/reports/types/report.types'

/** Categorias espelhadas em outra fonte do relatório — nunca contam via Financeiro. */
export const SYSTEM_MIRRORED_TRANSACTION_CATEGORIES = ['Reserva Avulsa', 'Rotativo'] as const

export type ReportQueryMode = 'full' | 'mensal' | 'avulso' | 'booking_scoped'

export type ReportSourceFlags = {
  mode: ReportQueryMode
  includeStationPayments: boolean
  includeRotativoInscricoes: boolean
  includeRotativoCreditos: boolean
  includeTransactions: boolean
}

type BookingLike = {
  plano_mensalista_id: string | null
  status: string | null
}

export function resolveReportSourceFlags(filters: PaymentStatusFilters = {}): ReportSourceFlags {
  const bookingScoped = Boolean(filters.courtId || filters.sportId)
  const tipo = filters.tipo

  if (bookingScoped) {
    return {
      mode: 'booking_scoped',
      includeStationPayments: false,
      includeRotativoInscricoes: false,
      includeRotativoCreditos: false,
      includeTransactions: false,
    }
  }

  if (tipo === 'avulso') {
    return {
      mode: 'avulso',
      includeStationPayments: false,
      includeRotativoInscricoes: false,
      includeRotativoCreditos: false,
      includeTransactions: false,
    }
  }

  if (tipo === 'mensal') {
    return {
      mode: 'mensal',
      includeStationPayments: false,
      includeRotativoInscricoes: false,
      includeRotativoCreditos: false,
      includeTransactions: true,
    }
  }

  return {
    mode: 'full',
    includeStationPayments: true,
    includeRotativoInscricoes: true,
    includeRotativoCreditos: true,
    includeTransactions: true,
  }
}

/**
 * - Mensalista confirmado: só via transação Mensalidade (sessão não entra).
 * - Avulso confirmado: Pago no relatório.
 * - Avulso reservado (não pago): Pendente no relatório (também gerenciável no Financeiro).
 * - Mensalista reservado ou cancelado: entra no relatório.
 *
 * No **extrato de ocupação** (`detalharPorHora`) a regra se inverte: ali a
 * pergunta é "quando o atleta usou o espaço", então toda reserva entra —
 * inclusive a de mensalista já confirmada (é justamente a aula que aconteceu) e
 * a avulsa cancelada (o gestor quer ver a data que caiu). Para não contar o mês
 * duas vezes, quem sai nesse modo são as transações de Mensalidade.
 */
export function shouldIncludeBookingRow(
  booking: BookingLike,
  options: { detalharPorHora?: boolean } = {}
): boolean {
  if (options.detalharPorHora) return true
  if (booking.plano_mensalista_id && booking.status === 'confirmed') return false
  if (
    !booking.plano_mensalista_id &&
    booking.status !== 'confirmed' &&
    booking.status !== 'reservado'
  ) {
    return false
  }
  return true
}

export function getMirroredTransactionCategories(stationTypeNames: string[]): string[] {
  return [...SYSTEM_MIRRORED_TRANSACTION_CATEGORIES, ...stationTypeNames]
}

/**
 * Transações criadas automaticamente por comandas, rotativo ou reservas.
 * Lançamentos manuais no Financeiro usam a mesma categoria, mas descrição livre.
 */
export function isSystemGeneratedMirroredTransaction(
  category: string,
  description: string | null | undefined,
  stationTypeNames: string[]
): boolean {
  const desc = (description ?? '').trim()

  if (category === 'Reserva Avulsa' && desc.startsWith('Reserva Avulsa - ')) return true

  if (category === 'Rotativo') {
    if (desc.startsWith('Rotativo - ') || desc.startsWith('Crédito de rotativo - ')) return true
  }

  if (stationTypeNames.includes(category) && desc.includes(' - Comanda #')) return true

  return false
}

/**
 * Define se uma transação de entrada deve aparecer no relatório.
 * - full: todas as entradas manuais + Mensalidade; exclui só espelhos automáticos
 * - mensal: só Mensalidade
 * - `detalharPorHora`: a Mensalidade sai (o mês já aparece hora a hora nas
 *   reservas); lançamento manual e demais categorias continuam.
 */
export function shouldIncludeTransactionRow(
  category: string,
  description: string | null | undefined,
  mode: ReportQueryMode,
  stationTypeNames: string[],
  options: { detalharPorHora?: boolean } = {}
): boolean {
  if (options.detalharPorHora && category === 'Mensalidade') return false
  if (mode === 'avulso' || mode === 'booking_scoped') return false
  if (mode === 'mensal') return category === 'Mensalidade'

  return !isSystemGeneratedMirroredTransaction(category, description, stationTypeNames)
}
