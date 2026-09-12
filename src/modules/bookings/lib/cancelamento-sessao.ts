import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/**
 * Textos do cancelamento de UMA sessão de plano mensalista.
 *
 * Ficam fora do componente porque a descrição do crédito é contrato com o
 * gestor: é o que ele vê no extrato de créditos do mensalista, meses depois,
 * para saber a que aquele valor se refere.
 */

/** "25/09/2026" */
export function diaCurto(startISO: string): string {
  return format(parseISO(startISO), 'dd/MM/yyyy')
}

/** "sexta-feira, 25 de setembro de 2026" */
export function diaExtenso(startISO: string): string {
  return format(parseISO(startISO), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
}

/** "14:00 às 15:00" */
export function faixaHoraria(startISO: string, endISO: string): string {
  return `${format(parseISO(startISO), 'HH:mm')} às ${format(parseISO(endISO), 'HH:mm')}`
}

/**
 * Descrição pré-preenchida do crédito. Texto fixo por decisão de produto —
 * mudar aqui muda o extrato de todo mundo.
 */
export function descricaoCreditoJogoCancelado(startISO: string): string {
  return `Crédito lançado referente a jogo não realizado do dia ${diaCurto(startISO)}`
}
