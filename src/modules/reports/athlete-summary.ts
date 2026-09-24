/**
 * Resumo por atleta do relatório de Pagamentos — "quem deve quanto" no período.
 *
 * O resumo não soma as linhas da tabela às cegas: a mensalidade de mensalista
 * entra pela própria cobrança (devido / pago / em aberto), porque a linha dela
 * mostra só o que falta (parcial) ou só o que entrou (quitada), e no extrato
 * por hora o mês aparece espalhado em várias horas. As horas dessas reservas
 * entram como uso, sem dinheiro, para não contar o mês duas vezes.
 *
 * O módulo é puro: quem monta as contribuições é `actions/reportActions.ts`.
 */

import type {
  PaymentStatusAthleteSummary,
  PaymentStatusRow,
} from '@/modules/reports/types/report.types'

export interface AthleteContribution {
  atletaId: string | null
  atleta: string | null
  telefone?: string | null
  /** Horas de uso (reserva não cancelada). */
  horas?: number
  /**
   * `uso` só soma horas (hora de mensalista cujo dinheiro vem da mensalidade);
   * `financeiro` soma dinheiro e decide o status.
   */
  tipo: 'uso' | 'financeiro'
  devido?: number
  pago?: number
  emAberto?: number
  cancelado?: boolean
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** Contribuição de uma linha comum (avulso, comanda, rotativo, lançamento manual). */
export function contribuicaoDaLinha(row: PaymentStatusRow): AthleteContribution {
  const valor = Number(row.valor ?? 0)
  const cancelado = row.status === 'Cancelado'
  return {
    atletaId: row.atletaId ?? null,
    atleta: row.atleta,
    telefone: row.telefone ?? null,
    horas: cancelado ? 0 : Number(row.horas ?? 0),
    tipo: 'financeiro',
    devido: cancelado ? 0 : valor,
    pago: row.status === 'Pago' ? valor : 0,
    emAberto: row.status === 'Pendente' ? valor : 0,
    cancelado,
  }
}

function chaveDoAtleta(c: AthleteContribution): string | null {
  if (c.atletaId) return c.atletaId
  const nome = (c.atleta ?? '').trim().toLowerCase()
  return nome ? `nome:${nome}` : null
}

export function buildAthleteSummaries(
  contribuicoes: AthleteContribution[]
): PaymentStatusAthleteSummary[] {
  const grupos = new Map<
    string,
    PaymentStatusAthleteSummary & { financeiros: number; cancelados: number }
  >()

  for (const c of contribuicoes) {
    const key = chaveDoAtleta(c)
    // Sem cadastro e sem nome (comanda de balcão, por exemplo) não há a quem cobrar.
    if (!key) continue

    const atual = grupos.get(key) ?? {
      key,
      atletaId: c.atletaId,
      atleta: c.atleta ?? 'Atleta',
      telefone: c.telefone ?? null,
      horas: 0,
      devido: 0,
      pago: 0,
      emAberto: 0,
      status: 'Pago' as const,
      financeiros: 0,
      cancelados: 0,
    }

    if (!atual.telefone && c.telefone) atual.telefone = c.telefone
    atual.horas += c.horas ?? 0
    if (c.tipo === 'financeiro') {
      atual.financeiros++
      if (c.cancelado) atual.cancelados++
      atual.devido += c.devido ?? 0
      atual.pago += c.pago ?? 0
      atual.emAberto += c.emAberto ?? 0
    }
    grupos.set(key, atual)
  }

  return [...grupos.values()]
    .map(({ financeiros, cancelados, ...resumo }) => {
      const emAberto = round2(resumo.emAberto)
      const status: PaymentStatusRow['status'] =
        emAberto > 0.01
          ? 'Pendente'
          : financeiros > 0 && cancelados === financeiros
            ? 'Cancelado'
            : 'Pago'
      return {
        ...resumo,
        horas: round2(resumo.horas),
        devido: round2(resumo.devido),
        pago: round2(resumo.pago),
        emAberto,
        status,
      }
    })
    .sort(
      (a, b) =>
        b.emAberto - a.emAberto ||
        a.atleta.localeCompare(b.atleta, 'pt-BR', { sensitivity: 'base' })
    )
}
