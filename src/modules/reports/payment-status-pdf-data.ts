/**
 * Dados puros para o PDF do relatório de Pagamentos — o que entra no
 * cabeçalho (endereço da arena) e a lista de "Filtros aplicados".
 *
 * Fica fora de `payment-status-pdf.ts` porque aquele módulo importa `jspdf`
 * (só existe no navegador); este não importa nada em tempo de execução, então
 * dá para testar sem jsdom nem mockar canvas/Image.
 */

import type { AbatimentoDoCredito } from '@/modules/reports/extrato-tabela'

export interface AppliedFiltersInput {
  /** Sempre presente — o relatório é sempre de um mês. */
  monthLabel: string
  tipo: 'todos' | 'avulso' | 'mensal'
  /** Nome já resolvido (a tela tem a lista de espaços/esportes em mãos). */
  courtName?: string | null
  sportName?: string | null
  atletaNome?: string | null
  /** Rótulo da recorrência filtrada ("Quadra 04 · Qua · 20:00 às 21:00"). */
  recorrenciaLabel?: string | null
  perfilLabel?: string | null
  rateio: boolean
  detalharPorHora: boolean
}

export interface AppliedFilter {
  label: string
  value: string
}

/**
 * Só os filtros que o gestor de fato aplicou — "Todos os espaços" ou Tipo de
 * Jogo = Todos não aparecem, senão a lista vira ruído em vez de um resumo do
 * que gerou aquele recorte.
 */
export function buildAppliedFiltersDescription(input: AppliedFiltersInput): AppliedFilter[] {
  const filtros: AppliedFilter[] = [{ label: 'Período', value: input.monthLabel }]

  if (input.tipo !== 'todos') {
    filtros.push({ label: 'Tipo de Jogo', value: input.tipo === 'avulso' ? 'Avulso' : 'Mensal' })
  }
  if (input.atletaNome) filtros.push({ label: 'Atleta', value: input.atletaNome })
  if (input.recorrenciaLabel) filtros.push({ label: 'Recorrência', value: input.recorrenciaLabel })
  if (input.perfilLabel) filtros.push({ label: 'Perfil de Atleta', value: input.perfilLabel })
  if (input.courtName) filtros.push({ label: 'Espaço', value: input.courtName })
  if (input.sportName) filtros.push({ label: 'Esporte', value: input.sportName })
  // Rateio só é um filtro de fato com Tipo = Mensal (é quando o checkbox existe).
  if (input.tipo === 'mensal' && input.rateio) {
    filtros.push({ label: 'Rateio', value: 'Ver linha a linha' })
  }
  if (input.detalharPorHora) {
    filtros.push({ label: 'Ocupação', value: 'Detalhar por hora' })
  }

  return filtros
}

export interface ArenaAddressInput {
  street: string | null
  number: string | null
  complement: string | null
  neighborhood: string | null
  city: string | null
  stateUf: string | null
}

/**
 * "Rua Exemplo, 123 - Sala 2 - Bairro Tal — Cidade/UF", omitindo pedaços
 * ausentes em vez de deixar vírgulas soltas. `null` quando não há nada —
 * a página decide se mostra a linha ou não.
 */
export function formatArenaAddressLine(addr: ArenaAddressInput): string | null {
  const numero = addr.number ? `, ${addr.number}` : ''
  const logradouro = addr.street ? `${addr.street}${numero}` : null
  const complemento = addr.complement || null

  const primeiraParte = [logradouro, complemento].filter(Boolean).join(' - ')

  const cidadeUf = [addr.city, addr.stateUf].filter(Boolean).join('/')
  const segundaParte = [addr.neighborhood, cidadeUf || null].filter(Boolean).join(' - ')

  const linha = [primeiraParte, segundaParte].filter((p) => p && p.length > 0).join(' — ')
  return linha || null
}

export interface ExtratoResumoInput {
  resumo: { horas: number; devido: number; pago: number; emAberto: number; status: string } | null
  conciliacoes: {
    professor: boolean
    cobradaPelaTabela: boolean
    mensalidade: number
    uso: number
    horasUso: number
    diferenca: number
    explicacao: string | null
    totalPelaTabela: number | null
    horasCanceladasSemCredito: number
    horasCanceladasComCredito: number
  }[]
  abatimento: AbatimentoDoCredito | null
  porRecorrencia: boolean
  dataDoSaldo: string
  formatCurrency: (value: number) => string
  formatHoras: (horas: number) => string
}

function linhaDoProfessor(
  c: ExtratoResumoInput['conciliacoes'][number],
  formatHoras: (horas: number) => string
): string[] {
  const partes: string[] = []
  if (c.horasCanceladasSemCredito > 0) partes.push(`Horas canceladas, fora do total: ${formatHoras(c.horasCanceladasSemCredito)}`)
  if (c.horasCanceladasComCredito > 0) {
    partes.push(`Horas canceladas com crédito lançado, no total: ${formatHoras(c.horasCanceladasComCredito)}`)
  }
  return partes
}

export function buildExtratoResumoLinhas(input: ExtratoResumoInput): string[][] {
  const { resumo, abatimento, formatCurrency, formatHoras } = input
  const linhas: string[][] = [
    resumo
      ? [
          `Horas no mês: ${formatHoras(resumo.horas)}`,
          `Total do mês: ${formatCurrency(resumo.devido)}`,
          `Pago: ${formatCurrency(resumo.pago)}`,
          `Em aberto: ${formatCurrency(resumo.emAberto)}`,
          `Situação: ${resumo.status}`,
        ]
      : ['Nenhum valor em aberto ou pago neste período.'],
  ]

  for (const c of input.conciliacoes) {
    if (c.professor) {
      const partes = c.cobradaPelaTabela ? linhaDoProfessor(c, formatHoras) : []
      if (partes.length > 0) linhas.push(partes)
      continue
    }
    if (!c.explicacao || Math.abs(c.diferenca) < 0.01) continue
    linhas.push([
      `Mensalidade: ${formatCurrency(c.mensalidade)}`,
      `Uso no mês (${formatHoras(c.horasUso)}): ${formatCurrency(c.uso)}`,
      `Diferença: ${formatCurrency(c.diferenca)} (${c.explicacao})`,
    ])
  }

  if (abatimento && (Math.abs(abatimento.saldo) >= 0.01 || abatimento.pagoAlemDoTotal >= 0.01)) {
    const credito = [
      input.porRecorrencia
        ? `Saldo de crédito nesta recorrência em ${input.dataDoSaldo}: ${formatCurrency(abatimento.saldo)}`
        : `Saldo de crédito em ${input.dataDoSaldo}: ${formatCurrency(abatimento.saldo)}`,
    ]
    if (abatimento.abatido >= 0.01 || abatimento.pagoAlemDoTotal >= 0.01) {
      if (abatimento.abatido >= 0.01) credito.push(`Crédito abatido: ${formatCurrency(abatimento.abatido)}`)
      if (abatimento.pagoAlemDoTotal >= 0.01) {
        credito.push(`Pago além do total: ${formatCurrency(abatimento.pagoAlemDoTotal)}`)
      }
      credito.push(`A pagar: ${formatCurrency(abatimento.aPagar)}`)
      credito.push(`Crédito restante: ${formatCurrency(abatimento.restante)}`)
    }
    linhas.push(credito)
  }

  return linhas
}
