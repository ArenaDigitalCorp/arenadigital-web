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

/** Um pedaço de 1h da sessão (o último pode ser menor, ex.: sessão de 1h30). */
export type BlocoHorario = { inicio: string; fim: string }

/**
 * Quebra a sessão em blocos de 1h a partir do início — são as opções que o
 * gestor marca para cancelar só parte do jogo.
 */
export function blocosDeHora(startISO: string, endISO: string): BlocoHorario[] {
  const inicio = parseISO(startISO).getTime()
  const fim = parseISO(endISO).getTime()
  const blocos: BlocoHorario[] = []
  for (let t = inicio; t < fim; t += 60 * 60 * 1000) {
    blocos.push({
      inicio: new Date(t).toISOString(),
      fim: new Date(Math.min(t + 60 * 60 * 1000, fim)).toISOString(),
    })
  }
  return blocos
}

/** Agrupa somente os blocos marcados que compartilham uma extremidade. */
export function selecaoDeCancelamento(blocos: BlocoHorario[], selecionados: number[]) {
  const indices = new Set(selecionados)
  const marcados = blocos.filter((_, indice) => indices.has(indice))
  const intervalos: BlocoHorario[] = []
  for (const bloco of marcados) {
    const anterior = intervalos.at(-1)
    if (anterior && anterior.fim === bloco.inicio) {
      anterior.fim = bloco.fim
    } else {
      intervalos.push({ ...bloco })
    }
  }
  return { intervalos, sessaoInteira: marcados.length > 0 && marcados.length === blocos.length }
}

export function listarFaixasHorarias(intervalos: BlocoHorario[]): string {
  return new Intl.ListFormat('pt-BR').format(intervalos.map(({ inicio, fim }) => faixaHoraria(inicio, fim)))
}

export function descricaoCreditoHorariosCancelados(inicioSessao: string, intervalos: BlocoHorario[]): string {
  return `${descricaoCreditoJogoCancelado(inicioSessao)} (${listarFaixasHorarias(intervalos)})`
}
