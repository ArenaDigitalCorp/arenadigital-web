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

export type IntervaloCancelamento =
  | { ok: true; inicio: string; fim: string; sessaoInteira: boolean }
  | { ok: false; erro: string }

/**
 * Intervalo a cancelar a partir dos blocos marcados (índices). Precisa ser
 * contíguo: a reserva é encurtada ou dividida em volta de UM intervalo.
 */
export function intervaloSelecionado(
  blocos: BlocoHorario[],
  selecionados: number[]
): IntervaloCancelamento {
  const idx = Array.from(new Set(selecionados))
    .filter((i) => i >= 0 && i < blocos.length)
    .sort((a, b) => a - b)
  if (idx.length === 0) return { ok: false, erro: 'Marque ao menos um horário para cancelar.' }
  if (idx.some((v, i) => i > 0 && v !== idx[i - 1] + 1)) {
    return {
      ok: false,
      erro: 'Marque horários seguidos. Para liberar horários separados, cancele um de cada vez.',
    }
  }
  return {
    ok: true,
    inicio: blocos[idx[0]].inicio,
    fim: blocos[idx[idx.length - 1]].fim,
    sessaoInteira: idx.length === blocos.length,
  }
}

/**
 * Descrição do crédito quando só parte do jogo é cancelada — o dia continua no
 * mesmo formato da descrição do dia inteiro, com o horário ao final.
 */
export function descricaoCreditoHorarioCancelado(inicioISO: string, fimISO: string): string {
  return `${descricaoCreditoJogoCancelado(inicioISO)} (${faixaHoraria(inicioISO, fimISO)})`
}
