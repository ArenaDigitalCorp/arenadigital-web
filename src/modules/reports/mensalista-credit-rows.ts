/**
 * Créditos de mensalista no relatório de Pagamentos — a seção "Créditos de
 * mensalista" da tela, a aba do Excel e a tabela do PDF (geral e extrato do
 * atleta), a partir de `mensalista_creditos`.
 *
 * Ficam FORA dos lançamentos, dos cards e do "Resumo por atleta": crédito não
 * é dinheiro em caixa. Ele só vira receita quando abate uma mensalidade, e
 * isso já aparece na linha da mensalidade (crédito aplicado conta como
 * liquidação, ver `mensalidade-rows.ts`). Somar aqui contaria o mesmo
 * dinheiro duas vezes.
 *
 * O módulo é puro: quem consulta é `actions/reportActions.ts`.
 */

import {
  CREDITO_TIPO_LABEL,
  formatRecorrenciaLabel,
  type RecorrenciaParaRotulo,
} from '@/modules/mensalistas/credito-recorrencia'
import type { PaymentStatusCreditRow } from '@/modules/reports/types/report.types'

/** Linha de `mensalista_creditos` com atleta e recorrência embutidos. */
export interface MensalistaCreditoMovimento {
  id: string
  tipo: string
  valor: number | string
  descricao: string | null
  created_at: string
  atleta: { id: string; nome_perfil: string | null } | null
  /** Recorrência vinculada pelo gestor; `null` = crédito sem vínculo. */
  plano: RecorrenciaParaRotulo | null
}

/** Uma linha por movimento, em ordem cronológica — é um extrato de crédito. */
export function buildMensalistaCreditRows(
  movimentos: MensalistaCreditoMovimento[]
): PaymentStatusCreditRow[] {
  return movimentos
    .map((m) => ({
      id: `mensalista-credito-${m.id}`,
      data: m.created_at,
      atleta: m.atleta?.nome_perfil ?? null,
      atletaId: m.atleta?.id ?? null,
      tipo: CREDITO_TIPO_LABEL[m.tipo] ?? m.tipo,
      valor: Number(m.valor),
      recorrencia: m.plano ? formatRecorrenciaLabel(m.plano) : null,
      descricao: m.descricao,
    }))
    .sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id))
}
