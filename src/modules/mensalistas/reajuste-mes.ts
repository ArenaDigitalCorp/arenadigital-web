/**
 * Regras da tela "Ajustar mensalidades do mês" — o que precisa de análise, o
 * que vem selecionado, os selos de cada linha, a validação do novo valor e o
 * impacto. O banco decide e aplica (`mensalista_reajuste_mes_preview` e
 * `reajustar_mensalidades_mes_lote_atomic`); isto só espelha as regras para a
 * tela responder sem ida ao servidor.
 *
 * Módulo puro: testável com `node --test`.
 */

import type { ReajusteMesItemStatus, ReajusteMesLinha } from '@/modules/mensalistas/types/mensalista.types'

export type Arredondamento = 'centavos' | 'real' | 'cinco'

export const ARREDONDAMENTO_LABEL: Record<Arredondamento, string> = {
  centavos: 'Centavos',
  real: 'R$ 1,00',
  cinco: 'R$ 5,00',
}

export type SeloReajuste = 'quitada' | 'cancelada' | 'rateio' | 'parcial' | 'pausa' | 'estreia' | 'encerra'

export const SELO_LABEL: Record<SeloReajuste, string> = {
  quitada: 'Quitada',
  cancelada: 'Cancelada',
  rateio: 'Rateio',
  parcial: 'Parcial',
  pausa: 'Pausa',
  estreia: 'Estreia',
  encerra: 'Encerra',
}

export const MOTIVO_IGNORADO_LABEL: Record<ReajusteMesItemStatus, string> = {
  ok: 'Ajustada',
  quitada: 'Já quitada',
  cancelada: 'Mensalidade cancelada',
  alterada: 'Alterada por outra pessoa — revise',
  abaixo_do_pago: 'Abaixo do que já foi pago',
  inativo: 'Recorrência não está mais ativa',
  sem_mensalidade: 'Sem mensalidade no mês',
  duplicado: 'Repetida no lote',
  sem_alteracao: 'Sem alteração',
  nao_encontrado: 'Recorrência não encontrada',
}

function round2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

export function arredondar(valor: number, modo: Arredondamento): number {
  if (modo === 'real') return Math.round(valor)
  if (modo === 'cinco') return Math.round(valor / 5) * 5
  return round2(valor)
}

/** Quitada/cancelada não se ajusta; plano por blocos já é proporcional sozinho. */
export function editavel(linha: ReajusteMesLinha): boolean {
  return (
    !linha.porBlocos &&
    linha.mensalidadeStatus !== 'quitado' &&
    linha.mensalidadeStatus !== 'cancelado'
  )
}

/** O valor cobrado no mês difere do que os jogos do mês sugerem. */
export function precisaAnalise(linha: ReajusteMesLinha): boolean {
  return (
    editavel(linha) &&
    linha.valorSugerido != null &&
    Math.abs(linha.valorSugerido - linha.valorAtual) >= 0.01
  )
}

export function selos(linha: ReajusteMesLinha): SeloReajuste[] {
  const lista: SeloReajuste[] = []
  if (linha.mensalidadeStatus === 'quitado') lista.push('quitada')
  if (linha.mensalidadeStatus === 'cancelado') lista.push('cancelada')
  if (linha.rateio) lista.push('rateio')
  if (linha.valorPago > 0 && linha.mensalidadeStatus !== 'quitado') lista.push('parcial')
  if (linha.jogosEmPausa > 0) lista.push('pausa')
  if (linha.estreia) lista.push('estreia')
  if (linha.encerra) lista.push('encerra')
  return lista
}

/**
 * Vem marcada a linha comum com diferença. Rateio, pagamento parcial, pausa,
 * estreia e encerramento vêm desmarcados: o gestor olha uma a uma.
 */
export function selecionadaPorPadrao(linha: ReajusteMesLinha): boolean {
  return precisaAnalise(linha) && selos(linha).length === 0
}

/** Ponto de partida do campo "Novo": a sugestão arredondada, ou o valor atual sem sugestão. */
export function valorInicial(linha: ReajusteMesLinha, modo: Arredondamento): number {
  return linha.valorSugerido == null ? linha.valorAtual : arredondar(linha.valorSugerido, modo)
}

export type ErroNovoValor = 'invalido' | 'abaixo_do_pago'

/** Mesma regra do banco: não negativo e, com pagamento, acima do já pago. */
export function validarNovoValor(linha: ReajusteMesLinha, novo: number): ErroNovoValor | null {
  if (!Number.isFinite(novo) || novo < 0 || novo > 100_000_000) return 'invalido'
  if (linha.valorPago > 0 && novo <= linha.valorPago + 0.005) return 'abaixo_do_pago'
  return null
}

export function semAlteracao(linha: ReajusteMesLinha, novo: number): boolean {
  return Math.abs(novo - linha.valorAtual) < 0.005
}

export function variacaoJogos(linha: ReajusteMesLinha): 'sobe' | 'desce' | 'igual' {
  if (linha.jogosLiquidos > linha.jogosAnterior) return 'sobe'
  if (linha.jogosLiquidos < linha.jogosAnterior) return 'desce'
  return 'igual'
}

/** "1.234,50" / "1234.5" → número; vazio ou lixo → NaN. */
export function parseValor(texto: string): number {
  const limpo = texto.trim().replace(/\s|R\$/g, '')
  if (!limpo) return Number.NaN
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo
  return Number(normalizado)
}

/** Quanto o mês muda no total (soma das diferenças). */
export function impacto(itens: { valorAtual: number; novoValor: number }[]): number {
  return round2(itens.reduce((total, i) => total + (i.novoValor - i.valorAtual), 0))
}
