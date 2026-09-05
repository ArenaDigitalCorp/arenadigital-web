import type { Database } from '@/types/supabase.types'
import type { PlanoMensalistaComDetalhes } from '@/modules/bookings/types/booking.types'

export type { PlanoMensalistaComDetalhes }

export type MensalidadeRow =
  Database['public']['Tables']['mensalista_mensalidades']['Row']
export type CobrancaRow =
  Database['public']['Tables']['mensalista_cobrancas']['Row']
export type PagamentoRow =
  Database['public']['Tables']['mensalista_pagamentos']['Row']
export type CreditoRow =
  Database['public']['Tables']['mensalista_creditos']['Row']

/** Uma linha do histórico de reajustes de valor de uma recorrência.
 *  Tipo manual: `planos_mensalista_reajustes` ainda não está nos tipos gerados. */
export interface ReajusteRow {
  id: string
  arena_id: string
  plano_id: string
  valor_anterior: number
  valor_novo: number
  escopo: 'mes_atual' | 'mes_seguinte'
  competencia_vigencia: string
  observacao: string | null
  registered_by: string | null
  created_at: string
}

export type StatusPlano = 'ativo' | 'encerrando' | 'cancelado'
export type SituacaoPagamento = 'quitado' | 'parcial' | 'pendente'
export type MensalidadeStatus = 'aberto' | 'parcial' | 'quitado' | 'cancelado'

/** One recurrence (plano_mensalista) with its charge for the viewed month. */
export interface RecorrenciaResumo {
  plano: PlanoMensalistaComDetalhes
  mensalidade: MensalidadeRow | null
  cobrancas: CobrancaRow[]
  /** Histórico de reajustes de valor desta recorrência (mais recente primeiro). */
  reajustes: ReajusteRow[]
}

/** Aggregated view of one responsible athlete for a competência. */
export interface MensalistaResumo {
  athleteId: string
  nome: string
  telefone: string | null
  statusPlano: StatusPlano
  recorrenciasCount: number
  inicio: string
  encerramentoPrevisto: string | null
  encerramentoObs: string | null
  valorMes: number
  recebidoMes: number
  restanteMes: number
  situacao: SituacaoPagamento
  creditoSaldo: number
  /** Débito acumulado de competências anteriores ao mês corrente ainda em aberto. */
  atrasoValor: number
  atrasoMeses: number
}

export interface MensalistasOverviewTotais {
  aReceber: number
  recebido: number
  restante: number
  encerrandoEmBreve: number
  atrasoTotal: number
  atrasoMensalistas: number
}

export interface MensalistasOverview {
  competencia: string
  resumos: MensalistaResumo[]
  totais: MensalistasOverviewTotais
}

/** Uma competência anterior em aberto/parcial de um responsável. */
export interface AtrasoCompetencia {
  competencia: string
  mensalidadeId: string
  planoId: string
  quadra: string | null
  valorDevido: number
  valorPago: number
  restante: number
  cobrancas: CobrancaRow[]
}

export interface PagamentoComContexto extends PagamentoRow {
  cobrancaNome: string
  competencia: string
}

export interface MensalistaDetalhe {
  competencia: string
  resumo: MensalistaResumo
  recorrencias: RecorrenciaResumo[]
  /** Competências anteriores ao mês corrente ainda em aberto (fora do mês visualizado). */
  atrasos: AtrasoCompetencia[]
  historicoPagamentos: PagamentoComContexto[]
  creditos: CreditoRow[]
  creditoSaldo: number
  /** Saldo do programa de fidelidade do atleta nesta arena. */
  fidelidade: { moeda: string | null; saldo: number }
}

export interface RateioParticipanteInput {
  atleta_id: string | null
  nome: string
  ativo: boolean
  valor: number
}

export interface RegistrarPagamentoInput {
  arenaId: string
  cobrancaId: string
  operationId: string
  valor: number
  creditoAplicado: number
  data: string
  modoPagamentoId: string | null
  observacao: string | null
}
