/**
 * Linhas de mensalista no relatório de Pagamentos, a partir da **cobrança** —
 * `mensalista_mensalidades` + `mensalista_cobrancas`, a mesma fonte da tela de
 * Mensalistas.
 *
 * Por que não pela transação de Mensalidade do Financeiro: o plano lança, na
 * criação, uma transação com o valor mensal CHEIO (`monthly_plan_month`,
 * herança do modelo anterior à camada mensalidade→cobrança→pagamento). No mês
 * de estreia a mensalidade é proporcional ao que sobrou do mês — um plano de
 * R$ 320 criado no meio de setembro deve R$ 240 —, e por ser uma entrada o
 * relatório ainda dava esse valor como recebido antes de qualquer pagamento.
 * Cada pagamento registrado gera ainda outra transação
 * (`mensalista_pagamento`), então somar as duas contaria o mesmo mês 2x.
 *
 * O módulo é puro: quem consulta é `actions/reportActions.ts`.
 */

import type { PaymentStatusRow } from '@/modules/reports/types/report.types'

export interface MensalistaCobranca {
  id: string
  mensalidade_id: string
  /** `null` = participante avulso identificado só pelo nome (sem cadastro de atleta). */
  atleta_id: string | null
  nome: string | null
  valor_devido: number | null
  valor_pago: number | null
  credito_aplicado: number | null
  pago_em: string | null
}

/** Mensalidade de um mês já resolvida com o contexto que a linha precisa mostrar. */
export interface MensalidadeContexto {
  id: string
  planoId: string
  /** Primeiro dia do mês (`YYYY-MM-01`). */
  competencia: string
  valorTotal: number
  status: string
  /** Responsável pelo plano — usado para casar com o filtro de Perfil de Atleta. */
  atletaId: string | null
  atleta: string | null
  telefone: string | null
  espaco: string | null
  esporte: string | null
  /** Faixa da recorrência, ou "Vários horários" quando o plano tem mais de um bloco. */
  horario: string | null
  cobrancas: MensalistaCobranca[]
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** Quanto foi liquidado (dinheiro + crédito) e quanto ainda falta numa cobrança. */
export function liquidacaoDaCobranca(c: MensalistaCobranca): {
  settled: number
  remaining: number
  isPago: boolean
} {
  const settled = Number(c.valor_pago ?? 0) + Number(c.credito_aplicado ?? 0)
  const remaining = Math.max(0, round2(Number(c.valor_devido ?? 0) - settled))
  return { settled, remaining, isPago: remaining <= 0.01 && settled > 0 }
}

/**
 * Quanto a mensalidade do mês representa e em que estado está.
 *
 * O devido sai das cobranças ativas (é o que sobra depois de desativar o rateio
 * de alguém); sem nenhuma, vale o `valor_total` da mensalidade. Crédito aplicado
 * conta como liquidação — o atleta não deve mais aquilo.
 */
export function resumoDaMensalidade(m: MensalidadeContexto): {
  valor: number
  status: PaymentStatusRow['status']
  /** Data do pagamento mais recente, quando a mensalidade já está quitada. */
  pagoEm: string | null
} {
  const settled = m.cobrancas.reduce((total, c) => total + liquidacaoDaCobranca(c).settled, 0)
  const devido = m.cobrancas.length
    ? m.cobrancas.reduce((total, c) => total + Number(c.valor_devido ?? 0), 0)
    : m.valorTotal
  const remaining = Math.max(0, round2(devido - settled))
  const isPago = remaining <= 0.01 && settled > 0

  if (m.status === 'cancelado') {
    return { valor: round2(devido), status: 'Cancelado', pagoEm: null }
  }

  const pagoEm =
    m.cobrancas
      .map((c) => c.pago_em)
      .filter((d): d is string => Boolean(d))
      .sort()
      .at(-1) ?? null

  return {
    valor: isPago ? round2(settled) : remaining,
    status: isPago ? 'Pago' : 'Pendente',
    pagoEm: isPago ? pagoEm : null,
  }
}

/**
 * Visão padrão: uma linha por mensalidade do mês, com o valor da **competência**
 * (proporcional no mês de estreia) e o status real da cobrança.
 */
export function buildMensalidadeRows(mensalidades: MensalidadeContexto[]): PaymentStatusRow[] {
  return mensalidades.map((m) => {
    const { valor, status, pagoEm } = resumoDaMensalidade(m)
    return {
      id: `mensalidade-${m.id}`,
      // Quitada, a data que o gestor procura é a do recebimento; em aberto, a
      // linha é do mês — competência, não instante.
      data: pagoEm ?? m.competencia,
      horario: m.horario,
      atleta: m.atleta,
      atletaId: m.atletaId,
      telefone: m.telefone,
      servico: 'Mensalista',
      espaco: m.espaco,
      esporte: m.esporte,
      valor,
      status,
    }
  })
}

/**
 * Visão "Rateio": uma linha `Recorrência` (contexto, sem valor — não entra na
 * soma dos cards) por plano e uma linha `Rateio` por cobrança ativa.
 */
export function buildRateioBreakdownRows(mensalidades: MensalidadeContexto[]): PaymentStatusRow[] {
  const rows: PaymentStatusRow[] = []

  for (const m of mensalidades) {
    rows.push({
      id: `recorrencia-${m.id}`,
      data: m.competencia,
      // A competência é um mês, não um instante: o horário vem da faixa da
      // recorrência (ou "Vários horários" quando o plano tem mais de um bloco).
      horario: m.horario,
      atleta: m.atleta,
      atletaId: m.atletaId,
      telefone: m.telefone,
      servico: 'Recorrência',
      espaco: m.espaco,
      esporte: m.esporte,
      valor: null,
      status: m.status === 'quitado' ? 'Pago' : 'Pendente',
    })

    for (const c of m.cobrancas) {
      const { settled, remaining, isPago } = liquidacaoDaCobranca(c)
      rows.push({
        id: `rateio-${c.id}`,
        data: c.pago_em ?? m.competencia,
        // Sem pagamento registrado a data é a competência — mês, não hora.
        horario: c.pago_em ? undefined : null,
        atleta: c.nome,
        atletaId: c.atleta_id,
        telefone: null,
        servico: 'Rateio',
        espaco: m.espaco,
        esporte: m.esporte,
        valor: isPago ? settled : remaining,
        status: isPago ? 'Pago' : 'Pendente',
      })
    }
  }

  return rows
}
