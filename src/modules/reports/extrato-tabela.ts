export interface TabelaDePreco {
  id: string
  courtId: string
  tipo: string
  isDefault: boolean
}

export interface PlanoComTabela {
  courtId: string | null
  priceTableId: string | null
}

export type PapelDaTabela = 'mensalista' | 'professor' | 'padrao'

const PAPEIS: readonly string[] = ['mensalista', 'professor', 'padrao']

export function papelDoPlano(
  plano: PlanoComTabela,
  tabelas: ReadonlyMap<string, TabelaDePreco>
): PapelDaTabela | null {
  if (!plano.priceTableId) return 'mensalista'
  const snapshot = tabelas.get(plano.priceTableId)
  if (!snapshot || snapshot.courtId !== plano.courtId) return null
  return PAPEIS.includes(snapshot.tipo) ? (snapshot.tipo as PapelDaTabela) : null
}

export function tabelasDaSessao(input: {
  plano: PlanoComTabela
  bookingCourtId: string
  bookingPriceTableId: string | null
  tabelas: ReadonlyMap<string, TabelaDePreco>
}): string[] {
  const { plano, bookingCourtId, bookingPriceTableId, tabelas } = input
  const doEspaco = [...tabelas.values()].filter((t) => t.courtId === bookingCourtId)
  const papel = papelDoPlano(plano, tabelas)
  const direta = (plano.courtId === bookingCourtId ? plano.priceTableId : null) ?? bookingPriceTableId
  const escolhida = direta ?? (papel ? doEspaco.find((t) => t.tipo === papel)?.id ?? null : null)

  if (papel === 'professor') return escolhida ? [escolhida] : []
  if (!escolhida && !papel) return []

  const padrao = doEspaco.find((t) => t.isDefault)?.id ?? null
  return [...new Set([escolhida, padrao].filter((id): id is string => Boolean(id)))]
}

export function tabelasDaReservaAvulsa(
  bookingCourtId: string,
  tabelas: ReadonlyMap<string, TabelaDePreco>
): string[] {
  const padrao = [...tabelas.values()].find((t) => t.courtId === bookingCourtId && t.isDefault)
  return padrao ? [padrao.id] : []
}

export interface SessaoDaMensalidade {
  horas: number
  cancelada: boolean
  valor: number | null
  comCredito: boolean
}

export interface ConciliacaoDaMensalidade {
  mensalidade: number
  uso: number
  horasUso: number
  diferenca: number
  horasCanceladas: number
  horasCanceladasSemCredito: number
  horasCanceladasComCredito: number
  horasSemPreco: number
  totalPelaTabela: number | null
  explicacao: string | null
  ajusteSugerido: number | null
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function formatarHoras(horas: number): string {
  return `${round2(horas).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}h`
}

function canceladas(horas: number): string {
  return `${formatarHoras(horas)} ${round2(horas) <= 1 ? 'cancelada' : 'canceladas'}`
}

function explicarCanceladas(horasSemCredito: number, horasComCredito: number): string {
  const partes: string[] = []
  if (horasSemCredito > 0) partes.push(`${canceladas(horasSemCredito)} sem crédito`)
  if (horasComCredito > 0) partes.push(`${canceladas(horasComCredito)} com crédito lançado`)
  return partes.join(' e ')
}

const somaValor = (lista: SessaoDaMensalidade[]) => round2(lista.reduce((total, s) => total + (s.valor ?? 0), 0))
const somaHoras = (lista: SessaoDaMensalidade[]) => round2(lista.reduce((total, s) => total + s.horas, 0))
const todasComValor = (lista: SessaoDaMensalidade[]) => lista.every((s) => s.valor != null)

export const PROFESSOR_FORA_DA_TABELA = 'mensalidade diferente da tabela de professor'
export const PROFESSOR_SEM_PRECO = 'sem preço na tabela de professor do espaço'

export function conciliarMensalidade(
  mensalidade: number,
  sessoes: SessaoDaMensalidade[],
  professor = false
): ConciliacaoDaMensalidade {
  const ativas = sessoes.filter((s) => !s.cancelada)
  const semCredito = sessoes.filter((s) => s.cancelada && !s.comCredito)
  const creditadas = sessoes.filter((s) => s.cancelada && s.comCredito)
  const uso = somaValor(ativas)
  const cobradas = professor ? [...ativas, ...creditadas] : ativas
  const totalPelaTabela = professor && todasComValor(cobradas) ? round2(uso + somaValor(creditadas)) : null
  const base = {
    mensalidade: round2(mensalidade),
    uso,
    horasUso: somaHoras(ativas),
    horasCanceladas: round2(somaHoras(semCredito) + somaHoras(creditadas)),
    horasCanceladasSemCredito: somaHoras(semCredito),
    horasCanceladasComCredito: somaHoras(creditadas),
    horasSemPreco: professor ? somaHoras(cobradas.filter((s) => s.valor == null)) : 0,
    totalPelaTabela,
  }
  const diferenca = round2(mensalidade - (totalPelaTabela ?? uso))

  if (Math.abs(diferenca) < 0.01) {
    return { ...base, diferenca: 0, explicacao: null, ajusteSugerido: null }
  }

  if (professor) {
    const explicada =
      semCredito.length > 0 && todasComValor(semCredito) && Math.abs(somaValor(semCredito) - diferenca) < 0.01
    return {
      ...base,
      diferenca,
      explicacao:
        totalPelaTabela == null
          ? PROFESSOR_SEM_PRECO
          : explicada
            ? explicarCanceladas(base.horasCanceladasSemCredito, 0)
            : PROFESSOR_FORA_DA_TABELA,
      ajusteSugerido: totalPelaTabela,
    }
  }

  const todasCanceladas = [...semCredito, ...creditadas]
  const explicadaPelasCanceladas =
    todasCanceladas.length > 0 &&
    todasComValor(todasCanceladas) &&
    Math.abs(somaValor(todasCanceladas) - diferenca) < 0.01

  return {
    ...base,
    diferenca,
    explicacao: explicadaPelasCanceladas
      ? explicarCanceladas(base.horasCanceladasSemCredito, base.horasCanceladasComCredito)
      : 'ajuste da mensalidade em relação ao uso',
    ajusteSugerido: explicadaPelasCanceladas ? round2(mensalidade - somaValor(semCredito)) : null,
  }
}

export interface ResumoDoMes {
  valor: number
  status: 'Pago' | 'Pendente' | 'Cancelado'
  pagoEm: string | null
  devido: number
  pago: number
  emAberto: number
}

export function totalDoExtratoPelaTabela(c: {
  professor: boolean
  rateio: boolean
  mensalidadeEmAberto: boolean
  totalPelaTabela: number | null
}): number | null {
  return c.professor && !c.rateio && c.mensalidadeEmAberto ? c.totalPelaTabela : null
}

export function resumoPeloTotalDaTabela<R extends ResumoDoMes>(resumo: R, totalPelaTabela: number | null): R {
  if (totalPelaTabela == null) return resumo
  const devido = round2(totalPelaTabela)
  const restante = Math.max(0, round2(devido - resumo.pago))
  if (devido <= 0.01 && resumo.pago <= 0.01) {
    return { ...resumo, valor: devido, status: 'Cancelado', pagoEm: null, devido, emAberto: 0 }
  }
  const quitado = restante <= 0.01 && resumo.pago > 0
  return {
    ...resumo,
    valor: quitado ? resumo.pago : restante,
    status: quitado ? 'Pago' : 'Pendente',
    pagoEm: quitado ? resumo.pagoEm : null,
    devido,
    emAberto: quitado ? 0 : restante,
  }
}

export interface AbatimentoDoCredito {
  saldo: number
  abatido: number
  aPagar: number
  restante: number
  pagoAlemDoTotal: number
}

export function abaterCreditoNoExtrato(
  saldo: number | null | undefined,
  totais: { devido: number; pago: number } | null
): AbatimentoDoCredito | null {
  if (saldo == null) return null
  const liquido = totais ? round2(totais.devido - totais.pago) : 0
  const emAberto = Math.max(liquido, 0)
  const pagoAlemDoTotal = Math.max(-liquido, 0)
  const disponivel = Math.max(round2(saldo), 0)
  const abatido = round2(Math.min(disponivel, emAberto))
  return {
    saldo: round2(saldo),
    abatido,
    aPagar: round2(emAberto - abatido),
    restante: round2(disponivel - abatido + pagoAlemDoTotal),
    pagoAlemDoTotal,
  }
}

export function podeAjustarMensalidadeDoProfessor(c: {
  professor: boolean
  rateio: boolean
  planoAtivo: boolean
  mensalidadeStatus: string
  pago: number
  mensalidade: number
  ajusteSugerido: number | null
}): boolean {
  return (
    c.professor &&
    !c.rateio &&
    c.planoAtivo &&
    c.mensalidadeStatus === 'Pendente' &&
    c.pago < 0.01 &&
    c.ajusteSugerido != null &&
    Math.abs(c.mensalidade - c.ajusteSugerido) >= 0.01
  )
}

export function ehSessaoDePlanoCancelado(input: {
  ehMensal: boolean
  cancelada: boolean
  statusDoPlano: string | null | undefined
}): boolean {
  return input.ehMensal && input.cancelada && input.statusDoPlano === 'cancelado'
}

export function reservasDoRateioDaMensalidade<T extends { status: string | null }>(reservas: T[]): T[] {
  const ativas = reservas.filter((r) => r.status !== 'cancelled')
  return ativas.length > 0 ? ativas : reservas
}

export function valorDaLinhaDoExtrato(input: {
  cobradaPelaTabela: boolean
  cancelada: boolean
  canceladaComCredito: boolean
  parte: number | null
}): { valorReserva: number | null; pelaTabela: boolean } {
  if (input.cobradaPelaTabela) {
    return { valorReserva: null, pelaTabela: !input.cancelada || input.canceladaComCredito }
  }
  return { valorReserva: input.cancelada ? null : input.parte, pelaTabela: false }
}
