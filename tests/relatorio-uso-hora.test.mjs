import assert from 'node:assert/strict'
import test from 'node:test'

import { buildUsageLines, saoPauloWallClock } from '../src/modules/reports/usage-lines.ts'
import {
  shouldIncludeBookingRow,
  shouldIncludeTransactionRow,
} from '../src/modules/reports/payment-report-sources.ts'

/** 17/09/2026 (quinta) 20:00 em São Paulo = 23:00 UTC do mesmo dia. */
const QUINTA_20H_SP = '2026-09-17T23:00:00.000Z'
const QUINTA_21H_SP = '2026-09-18T00:00:00.000Z'

test('wall clock de São Paulo preserva o dia da semana quando o UTC já virou', () => {
  // Em UTC isso é sexta 00:00; na arena ainda é quinta 21:00.
  const wall = saoPauloWallClock(new Date(QUINTA_21H_SP))
  assert.equal(wall.getDay(), 4, 'quinta-feira')
  assert.equal(wall.getHours(), 21)
  assert.equal(wall.getDate(), 17)
})

test('reserva de 2h vira duas linhas de uma hora, cada uma com o preço da sua faixa', () => {
  const precoPorHora = { 16: 80, 17: 120 }
  const linhas = buildUsageLines({
    // 01/09/2026 16:00–18:00 em São Paulo.
    startISO: '2026-09-01T19:00:00.000Z',
    endISO: '2026-09-01T21:00:00.000Z',
    precoDaHora: (wall) => precoPorHora[wall.getHours()] ?? null,
  })

  assert.equal(linhas.length, 2)
  assert.deepEqual(
    linhas.map((l) => [l.horas, l.valor]),
    [
      [1, 80],
      [1, 120],
    ]
  )
  assert.equal(linhas[0].inicioISO, '2026-09-01T19:00:00.000Z')
  assert.equal(linhas[0].fimISO, '2026-09-01T20:00:00.000Z')
  assert.equal(linhas[1].inicioISO, '2026-09-01T20:00:00.000Z')
})

test('mensalista é precificado pela tabela, não pela fatia da mensalidade gravada na reserva', () => {
  const linhas = buildUsageLines({
    startISO: QUINTA_20H_SP,
    endISO: QUINTA_21H_SP,
    valorReserva: null,
    valorFallback: 120,
    precoDaHora: () => 90,
  })

  assert.equal(linhas.length, 1)
  assert.equal(linhas[0].valor, 90)
})

test('sem tabela que cubra o horário, o mensalista cai no valor gravado na reserva', () => {
  const linhas = buildUsageLines({
    startISO: '2026-09-01T19:00:00.000Z',
    endISO: '2026-09-01T21:00:00.000Z',
    valorReserva: null,
    valorFallback: 120,
    precoDaHora: () => null,
  })

  assert.equal(linhas.length, 2)
  assert.equal(
    linhas.reduce((soma, l) => soma + l.valor, 0),
    120
  )
})

test('avulso rateia o valor cobrado e a soma bate ao centavo', () => {
  const linhas = buildUsageLines({
    startISO: '2026-09-01T19:00:00.000Z',
    endISO: '2026-09-01T22:00:00.000Z',
    valorReserva: 100,
    // Mesmo com tabela disponível, o valor negociado na reserva é quem manda.
    precoDaHora: () => 999,
  })

  assert.equal(linhas.length, 3)
  assert.deepEqual(
    linhas.map((l) => l.valor),
    [33.33, 33.33, 33.34]
  )
  assert.equal(
    linhas.reduce((soma, l) => soma + l.valor, 0),
    100
  )
})

test('última hora parcial é rateada por duração', () => {
  const linhas = buildUsageLines({
    startISO: '2026-09-01T19:00:00.000Z',
    endISO: '2026-09-01T20:30:00.000Z',
    precoDaHora: () => 100,
  })

  assert.deepEqual(
    linhas.map((l) => [l.horas, l.valor]),
    [
      [1, 100],
      [0.5, 50],
    ]
  )
})

test('espaço cobrado por evento devolve uma linha só, sem multiplicar por hora', () => {
  const linhas = buildUsageLines({
    startISO: '2026-09-01T19:00:00.000Z',
    endISO: '2026-09-01T22:00:00.000Z',
    bookingType: 'unique',
    precoDaHora: () => 250,
  })

  assert.equal(linhas.length, 1)
  assert.equal(linhas[0].horas, 3)
  assert.equal(linhas[0].valor, 250)
})

test('intervalo inválido não gera linha', () => {
  assert.deepEqual(
    buildUsageLines({ startISO: '2026-09-01T20:00:00.000Z', endISO: '2026-09-01T20:00:00.000Z' }),
    []
  )
  assert.deepEqual(buildUsageLines({ startISO: 'nao-e-data', endISO: 'nem-isso' }), [])
})

test('no extrato, a aula de mensalista já confirmada entra (fora dele continua saindo)', () => {
  const aulaConfirmada = { plano_mensalista_id: 'plano-1', status: 'confirmed' }

  assert.equal(shouldIncludeBookingRow(aulaConfirmada), false)
  assert.equal(shouldIncludeBookingRow(aulaConfirmada, { detalharPorHora: true }), true)
})

test('no extrato, a reserva avulsa cancelada aparece (o gestor quer ver a data que caiu)', () => {
  const avulsoCancelado = { plano_mensalista_id: null, status: 'cancelled' }

  assert.equal(shouldIncludeBookingRow(avulsoCancelado), false)
  assert.equal(shouldIncludeBookingRow(avulsoCancelado, { detalharPorHora: true }), true)
})

test('no extrato, a transação de Mensalidade sai para o mês não ser contado duas vezes', () => {
  assert.equal(shouldIncludeTransactionRow('Mensalidade', null, 'mensal', []), true)
  assert.equal(
    shouldIncludeTransactionRow('Mensalidade', null, 'mensal', [], { detalharPorHora: true }),
    false
  )
  // Lançamento manual não é uso de espaço: continua aparecendo.
  assert.equal(
    shouldIncludeTransactionRow('Outros', 'Ajuste de caixa', 'full', [], { detalharPorHora: true }),
    true
  )
})

test('sem tabela e sem valor gravado, a linha fica sem valor em vez de virar zero', () => {
  const linhas = buildUsageLines({
    startISO: '2026-09-01T19:00:00.000Z',
    endISO: '2026-09-01T20:00:00.000Z',
    precoDaHora: () => null,
  })

  assert.equal(linhas.length, 1)
  assert.equal(linhas[0].valor, null)
})
