import type { Database } from '@/types/supabase.types'
import type { PlanoMensalistaComDetalhes } from '@/modules/bookings/types/booking.types'
import type { SubcontaCredito } from '@/modules/mensalistas/credito-recorrencia'

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
  escopo: 'mes_atual' | 'mes_seguinte' | 'somente_mes'
  competencia_vigencia: string
  observacao: string | null
  registered_by: string | null
  created_at: string
  /** Lote do "Ajustar mensalidades do mês" que aplicou este ajuste; null = reajuste individual. */
  lote_id?: string | null
  /** Jogos do mês anterior e do mês ajustado, no momento do ajuste em lote. */
  ocorrencias_anterior?: number | null
  ocorrencias_competencia?: number | null
  /** Valor que a tela sugeriu (o `valor_novo` é o que o gestor confirmou). */
  valor_sugerido?: number | null
}

/** Uma linha do histórico de pausas de uma recorrência.
 *  Tipo manual: `planos_mensalista_pausas` ainda não está nos tipos gerados. */
export interface PausaRow {
  id: string
  arena_id: string
  plano_id: string
  pausa_inicio: string
  pausa_fim: string
  cobranca_modo: 'integral' | 'proporcional' | 'nenhuma'
  bookings_acao: 'liberar' | 'manter'
  status: 'ativa' | 'cancelada'
  observacao: string | null
  registered_by: string | null
  cancelada_em: string | null
  cancelada_por: string | null
  created_at: string
}

export type StatusPlano = 'ativo' | 'pausado' | 'encerrando' | 'cancelado'
export type SituacaoPagamento = 'quitado' | 'parcial' | 'pendente'
export type MensalidadeStatus = 'aberto' | 'parcial' | 'quitado' | 'cancelado'

/** One recurrence (plano_mensalista) with its charge for the viewed month. */
export interface RecorrenciaResumo {
  plano: PlanoMensalistaComDetalhes
  mensalidade: MensalidadeRow | null
  cobrancas: CobrancaRow[]
  /** Histórico de reajustes de valor desta recorrência (mais recente primeiro). */
  reajustes: ReajusteRow[]
  /** Histórico de pausas desta recorrência (mais recente primeiro). */
  pausas: PausaRow[]
  /** Participantes adicionais vinculados à reserva na criação do plano — sugeridos
   *  como participantes do rateio quando ele ainda não foi configurado. */
  participantesSugeridos: { id: string; nome: string }[]
  /**
   * Crédito ainda vinculado a esta recorrência, por atleta (responsável primeiro).
   * É o saldo da subconta desta recorrência de cada atleta
   * (`mensalista_credito_saldo_recorrencia`).
   */
  creditoVinculado: { atletaId: string; nome: string; valor: number }[]
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
  /** Sempre o valor_total da mensalidade — nunca a soma de valor_devido das
   *  cobranças, que deixou de ser garantidamente igual ao total com o
   *  rateio incremental. */
  valorDevido: number
  valorPago: number
  restante: number
  /** Se true, `cobrancas` são fatias de um rateio: o valor_devido individual
   *  de cada uma não é significativo (a UI deve olhar só o valor pago). */
  rateio: boolean
  cobrancas: CobrancaRow[]
}

/** Movimento de crédito com o rótulo da recorrência vinculada, quando houver. */
export interface CreditoComRecorrencia extends CreditoRow {
  /** "Quadra 04 · Qua · 20:00 às 21:00"; `null` quando o crédito não tem vínculo. */
  recorrenciaLabel: string | null
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
  creditos: CreditoComRecorrencia[]
  creditoSaldo: number
  /** Subcontas do crédito do responsável com saldo (geral primeiro) — de onde a retirada pode sair. */
  creditoSubcontas: SubcontaCredito[]
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

/** Uma recorrência na prévia do "Ajustar mensalidades do mês" (mensalista_reajuste_mes_preview). */
export interface ReajusteMesLinha {
  planoId: string
  athleteId: string
  atleta: string
  /** "Quadra 04 · Qua · 20:00 às 21:00". */
  recorrencia: string
  /** Plano por blocos: o valor já acompanha os jogos do mês sozinho — fora da edição. */
  porBlocos: boolean
  valorMensal: number
  sessoesPorMes: number
  /** Valor do contrato por jogo (valor_mensal ÷ sessoes_por_mes). */
  valorPorJogo: number | null
  /** Jogos do mês anterior, descontadas pausas. */
  jogosAnterior: number
  /** Quanto foi cobrado no mês anterior (null se não houve mensalidade). */
  valorAnterior: number | null
  jogos: number
  jogosEmPausa: number
  jogosLiquidos: number
  estreia: boolean
  encerra: boolean
  mensalidadeId: string
  mensalidadeStatus: string
  rateio: boolean
  valorAtual: number
  /** Dinheiro + crédito já recebidos na mensalidade do mês. */
  valorPago: number
  /** valor por jogo × jogos líquidos; null em plano por blocos ou sem jogos de contrato. */
  valorSugerido: number | null
}

export interface ReajusteMesPreview {
  /** `YYYY-MM`. */
  competencia: string
  linhas: ReajusteMesLinha[]
}

export type ReajusteMesItemStatus =
  | 'ok'
  | 'quitada'
  | 'cancelada'
  | 'alterada'
  | 'abaixo_do_pago'
  | 'inativo'
  | 'sem_mensalidade'
  | 'duplicado'
  | 'sem_alteracao'
  | 'nao_encontrado'

export interface ReajusteMesLoteResultado {
  loteId: string
  competencia: string
  aplicados: number
  ignorados: number
  impacto: number
  itens: {
    planoId: string
    status: ReajusteMesItemStatus
    valorAnterior: number | null
    valorNovo: number | null
  }[]
  idempotent: boolean
}
