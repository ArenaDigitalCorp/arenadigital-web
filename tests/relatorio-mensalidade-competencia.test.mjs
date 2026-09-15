import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildMensalidadeRows,
  buildRateioBreakdownRows,
  resumoDaMensalidade,
} from '../src/modules/reports/mensalidade-rows.ts'
import { shouldIncludeTransactionRow } from '../src/modules/reports/payment-report-sources.ts'

/**
 * Caso real do gestor (14/09/2026): plano de R$ 320/mês criado no meio de
 * setembro, com a estreia proporcional em R$ 240 e nada recebido ainda.
 */
const cobranca = (over = {}) => ({
  id: 'cob-1',
  mensalidade_id: 'mens-1',
  nome: 'Philip Coutinho',
  valor_devido: 240,
  valor_pago: 0,
  credito_aplicado: 0,
  pago_em: null,
  ...over,
})

const mensalidade = (over = {}) => ({
  id: 'mens-1',
  planoId: 'plano-1',
  competencia: '2026-09-01',
  valorTotal: 240,
  status: 'aberto',
  atleta: 'Philip Coutinho',
  espaco: '2 horários',
  esporte: 'Beach Tennis',
  horario: 'Vários horários',
  cobrancas: [cobranca()],
  ...over,
})

// ── O valor do mês é o da competência, não o mensal cheio ────────────────

test('estreia no meio do mês cobra o proporcional, em aberto', () => {
  const [row] = buildMensalidadeRows([mensalidade()])

  assert.equal(row.valor, 240, 'o mensal cheio (R$ 320) só vale a partir de outubro')
  assert.equal(row.status, 'Pendente', 'nada foi recebido — não pode entrar como pago')
  assert.equal(row.servico, 'Mensalista')
  assert.equal(row.data, '2026-09-01', 'em aberto, a linha é do mês')
})

test('mensalidade quitada mostra o recebido e a data do pagamento', () => {
  const [row] = buildMensalidadeRows([
    mensalidade({
      status: 'quitado',
      cobrancas: [cobranca({ valor_pago: 240, pago_em: '2026-09-20' })],
    }),
  ])

  assert.equal(row.valor, 240)
  assert.equal(row.status, 'Pago')
  assert.equal(row.data, '2026-09-20', 'quitada, a data que interessa é a do recebimento')
})

test('pagamento parcial deixa em aberto só o que falta', () => {
  const { valor, status } = resumoDaMensalidade(
    mensalidade({ status: 'parcial', cobrancas: [cobranca({ valor_pago: 100 })] })
  )

  assert.equal(valor, 140)
  assert.equal(status, 'Pendente')
})

test('crédito aplicado quita a mensalidade como dinheiro', () => {
  const { valor, status } = resumoDaMensalidade(
    mensalidade({ cobrancas: [cobranca({ credito_aplicado: 240 })] })
  )

  assert.equal(valor, 240)
  assert.equal(status, 'Pago', 'o atleta não deve mais — abatido por crédito')
})

test('sem cobrança ativa, o devido é o valor da própria mensalidade', () => {
  const { valor, status } = resumoDaMensalidade(mensalidade({ cobrancas: [] }))

  assert.equal(valor, 240)
  assert.equal(status, 'Pendente')
})

test('mensalidade cancelada não entra como cobrança do mês', () => {
  const [row] = buildMensalidadeRows([mensalidade({ status: 'cancelado' })])

  assert.equal(row.status, 'Cancelado', 'cancelado fica fora do "quanto cobrar"')
})

// ── Rateio: a soma das partes bate com a linha agregada ──────────────────

test('as linhas de rateio somam o mesmo que a linha agregada', () => {
  const m = mensalidade({
    cobrancas: [
      cobranca({ id: 'cob-1', nome: 'Philip', valor_devido: 120 }),
      cobranca({ id: 'cob-2', nome: 'Marina', valor_devido: 120 }),
    ],
  })

  const agregada = buildMensalidadeRows([m])[0]
  const rateio = buildRateioBreakdownRows([m])

  const somaRateio = rateio
    .filter((r) => r.servico === 'Rateio')
    .reduce((total, r) => total + (r.valor ?? 0), 0)

  assert.equal(somaRateio, agregada.valor)
  // A linha de contexto não pode ter valor: somaria o mês duas vezes.
  assert.equal(rateio.find((r) => r.servico === 'Recorrência').valor, null)
})

// ── A transação do Financeiro não pode duplicar a mensalidade ────────────

test('a transação lançada na criação do plano sai do relatório', () => {
  // `monthly_plan_month` carrega o mensal CHEIO (R$ 320) e é uma entrada —
  // aparecia como R$ 320 já pagos no mês que devia R$ 240 em aberto.
  assert.equal(
    shouldIncludeTransactionRow('Mensalidade', 'Mensalidade - Philip - 09/2026', 'mensal', [], {
      sourceType: 'monthly_plan_month',
    }),
    false
  )
})

test('a transação de pagamento registrado também sai — quem conta é a cobrança', () => {
  assert.equal(
    shouldIncludeTransactionRow('Mensalidade', 'Mensalidade - Philip - 09/2026', 'full', [], {
      sourceType: 'mensalista_pagamento',
    }),
    false
  )
})

test('lançamento manual de Mensalidade no Financeiro continua aparecendo', () => {
  assert.equal(
    shouldIncludeTransactionRow('Mensalidade', 'Acerto combinado', 'mensal', [], {
      sourceType: null,
    }),
    true
  )
})
