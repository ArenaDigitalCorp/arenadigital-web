import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildMensalidadeRows,
  buildRateioBreakdownRows,
  ratearMensalidadeNasReservas,
  resumoDaMensalidade,
  statusDaReservaDeMensalista,
} from '../src/modules/reports/mensalidade-rows.ts'
import { buildUsageLines } from '../src/modules/reports/usage-lines.ts'
import { buildAthleteSummaries, contribuicaoDaLinha } from '../src/modules/reports/athlete-summary.ts'
import {
  buildAthleteSummarySheetData,
  buildPaymentStatusSheetData,
} from '../src/modules/reports/payment-status-export.ts'

/**
 * Caso do gestor (24/09/2026): Perfil Mensalista + Status Pendente listava 6
 * mensalidades em aberto, mas com "Detalhar por hora" só sobrava o Alcindo.
 * O RPC de criação do plano grava as reservas do 1º mês como `confirmed` — o
 * extrato lia isso como "Pago" e o filtro Pendente escondia todo mundo que
 * estreou em setembro.
 */

const cobranca = (over = {}) => ({
  id: 'cob-1',
  mensalidade_id: 'mens-1',
  atleta_id: 'atl-izabel',
  nome: 'Izabel Policarpo',
  valor_devido: 560,
  valor_pago: 0,
  credito_aplicado: 0,
  pago_em: null,
  ...over,
})

const mensalidade = (over = {}) => ({
  id: 'mens-1',
  planoId: 'plano-1',
  competencia: '2026-09-01',
  valorTotal: 560,
  status: 'aberto',
  atletaId: 'atl-izabel',
  atleta: 'Izabel Policarpo',
  telefone: null,
  espaco: 'QUADRA 1 - COBERTA',
  esporte: 'Beach Tennis',
  horario: '18:00 às 20:00',
  cobrancas: [cobranca()],
  ...over,
})

// ── Status da hora vem da mensalidade, não da reserva ─────────────────────

test('reserva confirmed do 1º mês com mensalidade em aberto é Pendente no extrato', () => {
  const { status } = resumoDaMensalidade(mensalidade())
  assert.equal(status, 'Pendente')
  assert.equal(
    statusDaReservaDeMensalista('confirmed', status),
    'Pendente',
    '`confirmed` só diz que a sessão está na agenda — ninguém pagou ainda'
  )
})

test('mensalidade quitada deixa a reserva ainda `reservado` como Paga', () => {
  const quitada = mensalidade({
    status: 'quitado',
    cobrancas: [cobranca({ valor_pago: 560, pago_em: '2026-09-05' })],
  })
  assert.equal(statusDaReservaDeMensalista('reservado', resumoDaMensalidade(quitada).status), 'Pago')
})

test('sessão cancelada é Cancelado mesmo com a mensalidade em aberto', () => {
  assert.equal(statusDaReservaDeMensalista('cancelled', 'Pendente'), 'Cancelado')
})

test('plano cancelado deixa todas as horas do mês como Cancelado', () => {
  const cancelada = resumoDaMensalidade(mensalidade({ status: 'cancelado' }))
  assert.equal(statusDaReservaDeMensalista('confirmed', cancelada.status), 'Cancelado')
})

// ── Valor da hora = mensalidade rateada ───────────────────────────────────

test('o mês é rateado pelas horas e a soma bate ao centavo com a cobrança', () => {
  // 4 terças de 2h (18:00–20:00) = 8h para R$ 560.
  const reservas = ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22'].map((dia, i) => ({
    id: `b${i}`,
    inicioISO: `${dia}T21:00:00.000Z`,
    horas: 2,
  }))
  const partes = ratearMensalidadeNasReservas(560, reservas)

  assert.deepEqual([...partes.values()], [140, 140, 140, 140])

  const linhas = reservas.flatMap((r) =>
    buildUsageLines({
      startISO: r.inicioISO,
      endISO: new Date(new Date(r.inicioISO).getTime() + r.horas * 3_600_000).toISOString(),
      valorReserva: partes.get(r.id),
    })
  )
  assert.equal(linhas.length, 8, 'uma linha por hora')
  assert.ok(linhas.every((l) => l.valor === 70))
  assert.equal(linhas.reduce((t, l) => t + l.valor, 0), 560)
})

test('valor que não divide exato deixa a sobra na última reserva do mês', () => {
  const partes = ratearMensalidadeNasReservas(100, [
    { id: 'c', inicioISO: '2026-09-17T12:00:00.000Z', horas: 1 },
    { id: 'a', inicioISO: '2026-09-03T12:00:00.000Z', horas: 1 },
    { id: 'b', inicioISO: '2026-09-10T12:00:00.000Z', horas: 1 },
  ])
  assert.equal(partes.get('a'), 33.33)
  assert.equal(partes.get('b'), 33.33)
  assert.equal(partes.get('c'), 33.34, 'cronologicamente a última')
})

test('estreia proporcional: as horas somam o proporcional, não o mensal cheio', () => {
  // Plano de R$ 320 que estreou no meio do mês: deve R$ 240 por 3 sessões de 1h.
  const partes = ratearMensalidadeNasReservas(240, [
    { id: 'a', inicioISO: '2026-09-10T12:00:00.000Z', horas: 1 },
    { id: 'b', inicioISO: '2026-09-17T12:00:00.000Z', horas: 1 },
    { id: 'c', inicioISO: '2026-09-24T12:00:00.000Z', horas: 1 },
  ])
  assert.equal([...partes.values()].reduce((t, v) => t + v, 0), 240)
})

test('sem horas no mês não há rateio', () => {
  assert.equal(ratearMensalidadeNasReservas(480, []).size, 0)
})

// ── Mensalidade zerada por pausa não é "Pendente R$ 0,00" ────────────────

test('mensalidade zerada e sem pagamento sai como Cancelado, sem saldo', () => {
  const zerada = mensalidade({ valorTotal: 0, cobrancas: [cobranca({ valor_devido: 0 })] })
  const resumo = resumoDaMensalidade(zerada)
  assert.equal(resumo.status, 'Cancelado')
  assert.equal(resumo.emAberto, 0)

  const [row] = buildMensalidadeRows([zerada])
  assert.equal(row.status, 'Cancelado', 'não pode cair no filtro Pendente')
})

test('na visão Rateio, plano cancelado não deixa partes como Pendente', () => {
  const rows = buildRateioBreakdownRows([mensalidade({ status: 'cancelado' })])
  assert.ok(rows.every((r) => r.status === 'Cancelado'))
})

test('resumo expõe devido, pago e em aberto de um pagamento parcial', () => {
  const resumo = resumoDaMensalidade(mensalidade({ cobrancas: [cobranca({ valor_pago: 200 })] }))
  assert.equal(resumo.devido, 560)
  assert.equal(resumo.pago, 200)
  assert.equal(resumo.emAberto, 360)
  assert.equal(resumo.status, 'Pendente')
})

// ── Resumo por atleta ─────────────────────────────────────────────────────

test('resumo por atleta junta mensalidade, horas de uso e avulso', () => {
  const resumos = buildAthleteSummaries([
    // Mensalidade de R$ 560 com R$ 200 pagos.
    {
      atletaId: 'atl-izabel',
      atleta: 'Izabel Policarpo',
      tipo: 'financeiro',
      devido: 560,
      pago: 200,
      emAberto: 360,
      cancelado: false,
    },
    // 8h de uso vindas do extrato — sem dinheiro próprio.
    { atletaId: 'atl-izabel', atleta: 'Izabel Policarpo', tipo: 'uso', horas: 8 },
    // Uma avulsa paga.
    contribuicaoDaLinha({
      id: 'b-avulso',
      data: '2026-09-12T12:00:00.000Z',
      horas: 1,
      atleta: 'Izabel Policarpo',
      atletaId: 'atl-izabel',
      servico: 'Avulso',
      espaco: 'QUADRA 2',
      esporte: 'Beach Tennis',
      valor: 100,
      status: 'Pago',
    }),
  ])

  assert.equal(resumos.length, 1)
  const [izabel] = resumos
  assert.equal(izabel.horas, 9)
  assert.equal(izabel.devido, 660)
  assert.equal(izabel.pago, 300)
  assert.equal(izabel.emAberto, 360)
  assert.equal(izabel.status, 'Pendente')
})

test('atleta com tudo cancelado aparece como Cancelado; quem quitou, como Pago', () => {
  const resumos = buildAthleteSummaries([
    { atletaId: 'a', atleta: 'Ana', tipo: 'financeiro', devido: 0, pago: 0, emAberto: 0, cancelado: true },
    { atletaId: 'b', atleta: 'Bruno', tipo: 'financeiro', devido: 480, pago: 480, emAberto: 0, cancelado: false },
    { atletaId: 'c', atleta: 'Carla', tipo: 'financeiro', devido: 240, pago: 0, emAberto: 240, cancelado: false },
  ])
  const porNome = Object.fromEntries(resumos.map((r) => [r.atleta, r.status]))
  assert.deepEqual(porNome, { Ana: 'Cancelado', Bruno: 'Pago', Carla: 'Pendente' })
  assert.equal(resumos[0].atleta, 'Carla', 'quem deve mais vem primeiro')
})

test('linha sem atleta (comanda de balcão) não vira devedor', () => {
  const resumos = buildAthleteSummaries([
    contribuicaoDaLinha({
      id: 'c1',
      data: '2026-09-12T12:00:00.000Z',
      atleta: null,
      servico: 'Comanda',
      espaco: 'Bar',
      esporte: null,
      valor: 30,
      status: 'Pago',
    }),
  ])
  assert.equal(resumos.length, 0)
})

// ── Exportação ───────────────────────────────────────────────────────────

test('Excel do extrato ganha a coluna Dia logo depois da Data', () => {
  const [header, linha] = buildPaymentStatusSheetData(
    [
      {
        id: 'b0',
        data: '2026-09-01T21:00:00.000Z',
        horas: 1,
        atleta: 'Izabel Policarpo',
        servico: 'Mensalista',
        espaco: 'QUADRA 1 - COBERTA',
        esporte: 'Beach Tennis',
        valor: 70,
        status: 'Pendente',
      },
    ],
    () => '01/09/2026',
    () => '18:00 às 19:00',
    { diaSemana: () => 'Ter' }
  )
  assert.deepEqual(header.slice(0, 3), ['Data', 'Dia', 'Horário'])
  assert.deepEqual(linha.slice(0, 3), ['01/09/2026', 'Ter', '18:00 às 19:00'])
})

test('aba Resumo por atleta fecha com a linha de total', () => {
  const sheet = buildAthleteSummarySheetData(
    [
      { key: 'a', atletaId: 'a', atleta: 'Ana', telefone: null, horas: 4, devido: 240, pago: 0, emAberto: 240, status: 'Pendente' },
      { key: 'b', atletaId: 'b', atleta: 'Bruno', telefone: null, horas: 8, devido: 480, pago: 480, emAberto: 0, status: 'Pago' },
    ],
    { horas: true }
  )
  assert.deepEqual(sheet[0], ['Atleta', 'Horas', 'Total do mês', 'Pago', 'Em aberto', 'Status'])
  assert.deepEqual(sheet.at(-1), ['Total', 12, 720, 480, 240, ''])
})
