import assert from 'node:assert/strict'
import test from 'node:test'

import {
  PROFESSOR_FORA_DA_TABELA,
  PROFESSOR_SEM_PRECO,
  abaterCreditoNoExtrato,
  conciliarMensalidade,
  ehSessaoDePlanoCancelado,
  papelDoPlano,
  podeAjustarMensalidadeDoProfessor,
  reservasDoRateioDaMensalidade,
  resumoPeloTotalDaTabela,
  totalDoExtratoPelaTabela,
  tabelasDaReservaAvulsa,
  tabelasDaSessao,
  valorDaLinhaDoExtrato,
} from '../src/modules/reports/extrato-tabela.ts'
import { matchPriceDay, priceAtInstant } from '../src/modules/courts/lib/court-price-resolver.ts'
import { buildExtratoResumoLinhas } from '../src/modules/reports/payment-status-pdf-data.ts'
import { ratearMensalidadeNasReservas } from '../src/modules/reports/mensalidade-rows.ts'

const tabelas = new Map(
  [
    { id: 'prof-q1', courtId: 'q1', tipo: 'professor', isDefault: false },
    { id: 'mens-q1', courtId: 'q1', tipo: 'mensalista', isDefault: false },
    { id: 'pad-q1', courtId: 'q1', tipo: 'padrao', isDefault: true },
    { id: 'prof-q2', courtId: 'q2', tipo: 'professor', isDefault: false },
    { id: 'mens-q2', courtId: 'q2', tipo: 'mensalista', isDefault: false },
    { id: 'pad-q2', courtId: 'q2', tipo: 'padrao', isDefault: true },
    { id: 'promo-q2', courtId: 'q2', tipo: 'promo', isDefault: false },
    { id: 'pad-q3', courtId: 'q3', tipo: 'padrao', isDefault: true },
  ].map((t) => [t.id, t])
)

const planoProfessorQ2 = { courtId: 'q2', priceTableId: 'prof-q2' }

test('professor com tabela da quadra 2 jogando na quadra 1 usa a tabela professor da quadra 1', () => {
  assert.deepEqual(
    tabelasDaSessao({ plano: planoProfessorQ2, bookingCourtId: 'q1', bookingPriceTableId: null, tabelas }),
    ['prof-q1']
  )
})

test('professor na própria quadra usa a tabela do plano, sem cair na padrão', () => {
  assert.deepEqual(
    tabelasDaSessao({ plano: planoProfessorQ2, bookingCourtId: 'q2', bookingPriceTableId: null, tabelas }),
    ['prof-q2']
  )
})

test('professor em espaço sem tabela professor fica sem preço em vez de usar mensalista ou padrão', () => {
  assert.deepEqual(
    tabelasDaSessao({ plano: planoProfessorQ2, bookingCourtId: 'q3', bookingPriceTableId: null, tabelas }),
    []
  )
})

test('tabela gravada na reserva vale quando o plano é de outra quadra', () => {
  assert.deepEqual(
    tabelasDaSessao({ plano: planoProfessorQ2, bookingCourtId: 'q1', bookingPriceTableId: 'prof-q1', tabelas }),
    ['prof-q1']
  )
})

test('mensalista sem tabela no plano usa a mensalista do espaço e a padrão como rede', () => {
  assert.deepEqual(
    tabelasDaSessao({
      plano: { courtId: 'q1', priceTableId: null },
      bookingCourtId: 'q1',
      bookingPriceTableId: null,
      tabelas,
    }),
    ['mens-q1', 'pad-q1']
  )
})

test('tabela personalizada só vale na própria quadra', () => {
  const plano = { courtId: 'q2', priceTableId: 'promo-q2' }
  assert.deepEqual(tabelasDaSessao({ plano, bookingCourtId: 'q2', bookingPriceTableId: null, tabelas }), [
    'promo-q2',
    'pad-q2',
  ])
  assert.deepEqual(tabelasDaSessao({ plano, bookingCourtId: 'q1', bookingPriceTableId: null, tabelas }), [])
})

test('papel do plano vem do tipo da tabela gravada nele', () => {
  assert.equal(papelDoPlano(planoProfessorQ2, tabelas), 'professor')
  assert.equal(papelDoPlano({ courtId: 'q1', priceTableId: null }, tabelas), 'mensalista')
  assert.equal(papelDoPlano({ courtId: 'q1', priceTableId: 'prof-q2' }, tabelas), null)
  assert.equal(papelDoPlano({ courtId: 'q2', priceTableId: 'promo-q2' }, tabelas), null)
})

test('reserva avulsa usa a tabela padrão do espaço', () => {
  assert.deepEqual(tabelasDaReservaAvulsa('q1', tabelas), ['pad-q1'])
  assert.deepEqual(tabelasDaReservaAvulsa('sem-tabela', tabelas), [])
})

test('a hora do professor sai da tabela professor do espaço da reserva, não da mensalista', () => {
  const inicio = new Date(2026, 10, 4, 9)
  const fim = new Date(2026, 10, 4, 10)
  const noite = new Date(2026, 10, 4, 18)
  const dia = (precoManha, precoNoite) => [
    {
      diaSemana: inicio.getDay(),
      enabled: true,
      startTime: '06:00',
      endTime: '23:00',
      slotShiftTime: null,
      basePrice: precoManha,
      bands: [
        { start: '06:00', end: '18:00', price: precoManha },
        { start: '18:00', end: '23:00', price: precoNoite },
      ],
    },
  ]
  const grades = new Map([
    ['prof-q1', dia(65, 75)],
    ['mens-q1', dia(120, 120)],
    ['pad-q1', dia(150, 180)],
  ])
  const ids = tabelasDaSessao({ plano: planoProfessorQ2, bookingCourtId: 'q1', bookingPriceTableId: null, tabelas })
  const precoEm = (de, ate) => {
    for (const id of ids) {
      const match = matchPriceDay(grades.get(id), de, ate)
      if (match) return priceAtInstant(match, de)
    }
    return null
  }
  assert.equal(precoEm(inicio, fim), 65)
  assert.equal(precoEm(noite, new Date(2026, 10, 4, 19)), 75)
})

const sessoes = (ativas, canceladas, valor, comCredito = 0) => [
  ...Array.from({ length: ativas }, () => ({ horas: 1, cancelada: false, valor, comCredito: false })),
  ...Array.from({ length: canceladas }, (_, i) => ({ horas: 1, cancelada: true, valor, comCredito: i < comCredito })),
]

test('Fernanda: 52h lançadas, 36h usadas; pela tabela o mês do professor vale 2.340', () => {
  const c = conciliarMensalidade(3380, sessoes(36, 16, 65), true)
  assert.equal(c.uso, 2340)
  assert.equal(c.totalPelaTabela, 2340)
  assert.equal(c.horasUso, 36)
  assert.equal(c.diferenca, 1040)
  assert.equal(c.horasCanceladasSemCredito, 16)
  assert.equal(c.explicacao, '16h canceladas sem crédito')
  assert.equal(c.ajusteSugerido, 2340)
})

test('Alencastro: 57h lançadas, 50h usadas; pela tabela 3.250', () => {
  const c = conciliarMensalidade(3705, sessoes(50, 7, 65), true)
  assert.equal(c.totalPelaTabela, 3250)
  assert.equal(c.diferenca, 455)
  assert.equal(c.explicacao, '7h canceladas sem crédito')
  assert.equal(c.ajusteSugerido, 3250)
})

test('uma hora cancelada fica no singular', () => {
  assert.equal(conciliarMensalidade(260, sessoes(3, 1, 65), true).explicacao, '1h cancelada sem crédito')
})

test('professor: cancelada com crédito lançado continua no total, porque o crédito já a compensa', () => {
  const c = conciliarMensalidade(325, sessoes(2, 3, 65, 1), true)
  assert.equal(c.totalPelaTabela, 195)
  assert.equal(c.horasCanceladasComCredito, 1)
  assert.equal(c.horasCanceladasSemCredito, 2)
  assert.equal(c.diferenca, 130)
  assert.equal(c.explicacao, '2h canceladas sem crédito')
  assert.equal(c.ajusteSugerido, 195)
})

test('professor depois de um ajuste: nova cancelada volta a pedir o valor da tabela', () => {
  const c = conciliarMensalidade(2340, sessoes(35, 17, 65), true)
  assert.equal(c.totalPelaTabela, 2275)
  assert.equal(c.diferenca, 65)
  assert.equal(c.explicacao, PROFESSOR_FORA_DA_TABELA)
  assert.equal(c.ajusteSugerido, 2275)
})

test('professor com mensalidade abaixo da tabela: o total segue a tabela', () => {
  const c = conciliarMensalidade(243.23, [...sessoes(20, 0, 65), ...sessoes(5, 0, 69)], true)
  assert.equal(c.totalPelaTabela, 1645)
  assert.equal(c.diferenca, -1401.77)
  assert.equal(c.explicacao, PROFESSOR_FORA_DA_TABELA)
  assert.equal(c.ajusteSugerido, 1645)
})

test('professor com hora sem preço na tabela não tem total pela tabela nem ajuste', () => {
  const c = conciliarMensalidade(260, [...sessoes(3, 0, 65), { horas: 1, cancelada: false, valor: null, comCredito: false }], true)
  assert.equal(c.totalPelaTabela, null)
  assert.equal(c.horasSemPreco, 1)
  assert.equal(c.explicacao, PROFESSOR_SEM_PRECO)
  assert.equal(c.ajusteSugerido, null)
})

test('professor com mensalidade igual à tabela não gera explicação', () => {
  const c = conciliarMensalidade(260, sessoes(4, 0, 65), true)
  assert.equal(c.totalPelaTabela, 260)
  assert.equal(c.diferenca, 0)
  assert.equal(c.explicacao, null)
  assert.equal(c.ajusteSugerido, null)
})

test('mensalista comum: o mês continua devido e as canceladas explicam a diferença', () => {
  const c = conciliarMensalidade(320, sessoes(3, 1, 80))
  assert.equal(c.totalPelaTabela, null)
  assert.equal(c.uso, 240)
  assert.equal(c.diferenca, 80)
  assert.equal(c.explicacao, '1h cancelada sem crédito')
})

test('mensalista comum: cancelada com crédito entra na explicação e fica fora do ajuste', () => {
  const c = conciliarMensalidade(325, sessoes(2, 3, 65, 1))
  assert.equal(c.diferenca, 195)
  assert.equal(c.explicacao, '2h canceladas sem crédito e 1h cancelada com crédito lançado')
  assert.equal(c.ajusteSugerido, 195)
})

test('mensalista comum: diferença que as canceladas não explicam ganha rótulo genérico', () => {
  const c = conciliarMensalidade(400, sessoes(4, 1, 65))
  assert.equal(c.diferenca, 140)
  assert.equal(c.explicacao, 'ajuste da mensalidade em relação ao uso')
  assert.equal(c.ajusteSugerido, null)
})

test('mensalista comum: cancelada sem valor não explica a diferença', () => {
  const c = conciliarMensalidade(260, [...sessoes(3, 0, 65), { horas: 1, cancelada: true, valor: null, comCredito: false }])
  assert.equal(c.explicacao, 'ajuste da mensalidade em relação ao uso')
})

const resumo = (devido, pago, status = 'Pendente') => ({
  valor: Math.max(devido - pago, 0),
  status,
  pagoEm: null,
  devido,
  pago,
  emAberto: Math.max(devido - pago, 0),
})

test('resumo do professor passa a valer o total pela tabela', () => {
  const r = resumoPeloTotalDaTabela(resumo(3380, 0), 2340)
  assert.equal(r.devido, 2340)
  assert.equal(r.emAberto, 2340)
  assert.equal(r.status, 'Pendente')
})

test('resumo do professor quitado pela tabela vira Pago mesmo com a mensalidade maior', () => {
  const r = resumoPeloTotalDaTabela({ ...resumo(3380, 2340), pagoEm: null }, 2340)
  assert.equal(r.status, 'Pago')
  assert.equal(r.emAberto, 0)
  assert.equal(r.valor, 2340)
})

test('resumo do professor abaixo da tabela, com pagamento parcial, cobra o resto pela tabela', () => {
  const r = resumoPeloTotalDaTabela(resumo(243.23, 100), 1645)
  assert.equal(r.status, 'Pendente')
  assert.equal(r.devido, 1645)
  assert.equal(r.emAberto, 1545)
})

test('resumo sem total pela tabela fica como está', () => {
  const original = resumo(3380, 0)
  assert.equal(resumoPeloTotalDaTabela(original, null), original)
})

test('só mensalidade de professor em aberto e sem rateio passa a cobrar pela tabela; quitada ou cancelada fica como foi', () => {
  const base = { professor: true, rateio: false, mensalidadeEmAberto: true, totalPelaTabela: 2340 }
  assert.equal(totalDoExtratoPelaTabela(base), 2340)
  assert.equal(totalDoExtratoPelaTabela({ ...base, rateio: true }), null)
  assert.equal(totalDoExtratoPelaTabela({ ...base, mensalidadeEmAberto: false }), null)
  assert.equal(totalDoExtratoPelaTabela({ ...base, professor: false }), null)
  assert.equal(totalDoExtratoPelaTabela({ ...base, totalPelaTabela: null }), null)
})

test('resumo do professor com todas as horas canceladas e nada pago fica Cancelado', () => {
  const r = resumoPeloTotalDaTabela(resumo(260, 0), 0)
  assert.equal(r.status, 'Cancelado')
  assert.equal(r.devido, 0)
})

test('crédito da Fernanda abate o extrato inteiro e sobram 540', () => {
  const a = abaterCreditoNoExtrato(3075, { devido: 2535, pago: 0 })
  assert.deepEqual(a, { saldo: 3075, abatido: 2535, aPagar: 0, restante: 540, pagoAlemDoTotal: 0 })
})

test('crédito restante não muda depois de aplicar o crédito na mensalidade', () => {
  const antes = abaterCreditoNoExtrato(3075, { devido: 2535, pago: 0 })
  const depois = abaterCreditoNoExtrato(735, { devido: 2535, pago: 2340 })
  const aplicadoNaMensalidadeAntiga = abaterCreditoNoExtrato(0, { devido: 2535, pago: 3075 })
  assert.equal(depois.restante, antes.restante)
  assert.equal(depois.aPagar, 0)
  assert.equal(aplicadoNaMensalidadeAntiga.restante, antes.restante)
  assert.equal(aplicadoNaMensalidadeAntiga.pagoAlemDoTotal, 540)
})

test('crédito menor que o em aberto deixa o resto a pagar', () => {
  assert.deepEqual(abaterCreditoNoExtrato(500, { devido: 3250, pago: 0 }), {
    saldo: 500,
    abatido: 500,
    aPagar: 2750,
    restante: 0,
    pagoAlemDoTotal: 0,
  })
})

test('sem atleta filtrado não há abatimento; saldo negativo não abate nada', () => {
  assert.equal(abaterCreditoNoExtrato(null, { devido: 100, pago: 0 }), null)
  assert.deepEqual(abaterCreditoNoExtrato(-50, { devido: 100, pago: 0 }), {
    saldo: -50,
    abatido: 0,
    aPagar: 100,
    restante: 0,
    pagoAlemDoTotal: 0,
  })
})

const conciliacaoProfessor = {
  professor: true,
  rateio: false,
  planoAtivo: true,
  mensalidadeStatus: 'Pendente',
  pago: 0,
  mensalidade: 3380,
  ajusteSugerido: 2340,
}

test('ajuste da mensalidade só é oferecido quando o reajuste do mês consegue gravar', () => {
  assert.equal(podeAjustarMensalidadeDoProfessor(conciliacaoProfessor), true)
  assert.equal(podeAjustarMensalidadeDoProfessor({ ...conciliacaoProfessor, mensalidade: 243.23, ajusteSugerido: 1645 }), true)
  assert.equal(podeAjustarMensalidadeDoProfessor({ ...conciliacaoProfessor, pago: 100 }), false)
  assert.equal(podeAjustarMensalidadeDoProfessor({ ...conciliacaoProfessor, rateio: true }), false)
  assert.equal(podeAjustarMensalidadeDoProfessor({ ...conciliacaoProfessor, planoAtivo: false }), false)
  assert.equal(podeAjustarMensalidadeDoProfessor({ ...conciliacaoProfessor, mensalidadeStatus: 'Pago' }), false)
  assert.equal(podeAjustarMensalidadeDoProfessor({ ...conciliacaoProfessor, ajusteSugerido: null }), false)
  assert.equal(podeAjustarMensalidadeDoProfessor({ ...conciliacaoProfessor, ajusteSugerido: 3380 }), false)
  assert.equal(podeAjustarMensalidadeDoProfessor({ ...conciliacaoProfessor, professor: false }), false)
})

test('sessão cancelada só some do extrato quando o plano foi cancelado', () => {
  assert.equal(ehSessaoDePlanoCancelado({ ehMensal: true, cancelada: true, statusDoPlano: 'cancelado' }), true)
  assert.equal(ehSessaoDePlanoCancelado({ ehMensal: true, cancelada: true, statusDoPlano: 'ativo' }), false)
  assert.equal(ehSessaoDePlanoCancelado({ ehMensal: true, cancelada: true, statusDoPlano: 'pausado' }), false)
  assert.equal(ehSessaoDePlanoCancelado({ ehMensal: true, cancelada: true, statusDoPlano: 'encerrando' }), false)
  assert.equal(ehSessaoDePlanoCancelado({ ehMensal: true, cancelada: false, statusDoPlano: 'cancelado' }), false)
  assert.equal(ehSessaoDePlanoCancelado({ ehMensal: false, cancelada: true, statusDoPlano: null }), false)
  assert.equal(ehSessaoDePlanoCancelado({ ehMensal: true, cancelada: true, statusDoPlano: undefined }), false)
})

const brl = (v) => `R$ ${v.toFixed(2)}`
const horas = (h) => `${h}h`
const professorFernanda = {
  professor: true,
  cobradaPelaTabela: true,
  mensalidade: 3380,
  uso: 2340,
  horasUso: 36,
  diferenca: 1040,
  explicacao: '16h canceladas sem crédito',
  totalPelaTabela: 2340,
  horasCanceladasSemCredito: 16,
  horasCanceladasComCredito: 0,
}

test('extrato da Fernanda: total pela tabela, canceladas fora do total e crédito restante de 540', () => {
  const resumoDoMes = { horas: 39, devido: 2535, pago: 0, emAberto: 2535, status: 'Pendente' }
  const linhas = buildExtratoResumoLinhas({
    resumo: resumoDoMes,
    conciliacoes: [professorFernanda],
    abatimento: abaterCreditoNoExtrato(3075, resumoDoMes),
    porRecorrencia: false,
    dataDoSaldo: '26/11',
    formatCurrency: brl,
    formatHoras: horas,
  })
  assert.deepEqual(linhas, [
    ['Horas no mês: 39h', 'Total do mês: R$ 2535.00', 'Pago: R$ 0.00', 'Em aberto: R$ 2535.00', 'Situação: Pendente'],
    ['Horas canceladas, fora do total: 16h'],
    [
      'Saldo de crédito em 26/11: R$ 3075.00',
      'Crédito abatido: R$ 2535.00',
      'A pagar: R$ 0.00',
      'Crédito restante: R$ 540.00',
    ],
  ])
})

test('extrato do professor não mostra a mensalidade lançada nem a diferença ao atleta', () => {
  const linhas = buildExtratoResumoLinhas({
    resumo: { horas: 25, devido: 1645, pago: 0, emAberto: 1645, status: 'Pendente' },
    conciliacoes: [
      { ...professorFernanda, mensalidade: 243.23, uso: 1645, diferenca: -1401.77, totalPelaTabela: 1645, horasCanceladasSemCredito: 0 },
      { ...professorFernanda, totalPelaTabela: null, cobradaPelaTabela: false },
    ],
    abatimento: null,
    porRecorrencia: false,
    dataDoSaldo: '26/11',
    formatCurrency: brl,
    formatHoras: horas,
  })
  assert.equal(linhas.length, 1)
})

test('professor com rateio continua cobrando a mensalidade e não diz que as canceladas ficaram fora', () => {
  const linhas = buildExtratoResumoLinhas({
    resumo: { horas: 36, devido: 3380, pago: 0, emAberto: 3380, status: 'Pendente' },
    conciliacoes: [{ ...professorFernanda, cobradaPelaTabela: false }],
    abatimento: null,
    porRecorrencia: false,
    dataDoSaldo: '26/11',
    formatCurrency: brl,
    formatHoras: horas,
  })
  assert.equal(linhas.length, 1)
})

test('extrato de mensalista comum mostra a diferença explicada pelas canceladas', () => {
  const linhas = buildExtratoResumoLinhas({
    resumo: { horas: 3, devido: 320, pago: 0, emAberto: 320, status: 'Pendente' },
    conciliacoes: [
      {
        professor: false,
        cobradaPelaTabela: false,
        mensalidade: 320,
        uso: 240,
        horasUso: 3,
        diferenca: 80,
        explicacao: '1h cancelada sem crédito',
        totalPelaTabela: null,
        horasCanceladasSemCredito: 1,
        horasCanceladasComCredito: 0,
      },
    ],
    abatimento: null,
    porRecorrencia: false,
    dataDoSaldo: '26/11',
    formatCurrency: brl,
    formatHoras: horas,
  })
  assert.deepEqual(linhas[1], ['Mensalidade: R$ 320.00', 'Uso no mês (3h): R$ 240.00', 'Diferença: R$ 80.00 (1h cancelada sem crédito)'])
})

test('extrato com crédito já aplicado mantém os 540 restantes', () => {
  const resumoDoMes = { horas: 39, devido: 2535, pago: 2340, emAberto: 195, status: 'Pendente' }
  const linhas = buildExtratoResumoLinhas({
    resumo: resumoDoMes,
    conciliacoes: [],
    abatimento: abaterCreditoNoExtrato(735, resumoDoMes),
    porRecorrencia: true,
    dataDoSaldo: '26/11',
    formatCurrency: brl,
    formatHoras: horas,
  })
  assert.deepEqual(linhas.at(-1), [
    'Saldo de crédito nesta recorrência em 26/11: R$ 735.00',
    'Crédito abatido: R$ 195.00',
    'A pagar: R$ 0.00',
    'Crédito restante: R$ 540.00',
  ])
})

test('saldo sem nada em aberto aparece sozinho', () => {
  const linhas = buildExtratoResumoLinhas({
    resumo: null,
    conciliacoes: [],
    abatimento: abaterCreditoNoExtrato(735, null),
    porRecorrencia: true,
    dataDoSaldo: '26/11',
    formatCurrency: brl,
    formatHoras: horas,
  })
  assert.deepEqual(linhas, [
    ['Nenhum valor em aberto ou pago neste período.'],
    ['Saldo de crédito nesta recorrência em 26/11: R$ 735.00'],
  ])
})

test('sem saldo de crédito o resumo fica só com os totais', () => {
  const linhas = buildExtratoResumoLinhas({
    resumo: { horas: 4, devido: 260, pago: 260, emAberto: 0, status: 'Pago' },
    conciliacoes: [],
    abatimento: abaterCreditoNoExtrato(0, { devido: 260, pago: 260 }),
    porRecorrencia: false,
    dataDoSaldo: '26/11',
    formatCurrency: brl,
    formatHoras: horas,
  })
  assert.equal(linhas.length, 1)
})

test('mensalidade cobrada pela tabela: a linha sai da tabela, e a cancelada só quando tem crédito', () => {
  const linha = (cancelada, canceladaComCredito) =>
    valorDaLinhaDoExtrato({ cobradaPelaTabela: true, cancelada, canceladaComCredito, parte: 81.25 })
  assert.deepEqual(linha(false, false), { valorReserva: null, pelaTabela: true })
  assert.deepEqual(linha(true, true), { valorReserva: null, pelaTabela: true })
  assert.deepEqual(linha(true, false), { valorReserva: null, pelaTabela: false })
})

test('professor com mês fechado, rateio ou sem preço continua com a parte da mensalidade, como mensalista comum', () => {
  const linha = (cancelada) =>
    valorDaLinhaDoExtrato({ cobradaPelaTabela: false, cancelada, canceladaComCredito: cancelada, parte: 81.25 })
  assert.deepEqual(linha(false), { valorReserva: 81.25, pelaTabela: false })
  assert.deepEqual(linha(true), { valorReserva: null, pelaTabela: false })
})

test('a mensalidade se divide só entre as reservas não canceladas, e as linhas somam o devido', () => {
  const reservas = [
    { id: 'a', status: 'confirmed', inicioISO: '2026-11-03T22:00:00Z', horas: 1 },
    { id: 'b', status: 'cancelled', inicioISO: '2026-11-10T22:00:00Z', horas: 1 },
    { id: 'c', status: 'confirmed', inicioISO: '2026-11-17T22:00:00Z', horas: 2 },
  ]
  const ativas = reservasDoRateioDaMensalidade(reservas)
  assert.deepEqual(ativas.map((r) => r.id), ['a', 'c'])
  const partes = ratearMensalidadeNasReservas(840, ativas)
  assert.equal(partes.get('b'), undefined)
  assert.equal(partes.get('a') + partes.get('c'), 840)
  const c = conciliarMensalidade(
    840,
    reservas.map((r) => ({ horas: r.horas, cancelada: r.status === 'cancelled', valor: partes.get(r.id) ?? null, comCredito: false }))
  )
  assert.equal(c.diferenca, 0)
  assert.equal(c.explicacao, null)
})

test('mês com todas as reservas canceladas: as linhas ficam sem valor e o PDF diz que as horas foram canceladas', () => {
  const reservas = [
    { id: 'a', status: 'cancelled', inicioISO: '2026-11-04T22:00:00Z', horas: 1 },
    { id: 'b', status: 'cancelled', inicioISO: '2026-11-11T22:00:00Z', horas: 1 },
  ]
  const partes = ratearMensalidadeNasReservas(480, reservasDoRateioDaMensalidade(reservas))
  for (const r of reservas) {
    assert.deepEqual(
      valorDaLinhaDoExtrato({ cobradaPelaTabela: false, cancelada: true, canceladaComCredito: false, parte: partes.get(r.id) ?? null }),
      { valorReserva: null, pelaTabela: false }
    )
  }
  const c = conciliarMensalidade(
    480,
    reservas.map((r) => ({ horas: r.horas, cancelada: true, valor: partes.get(r.id) ?? null, comCredito: false }))
  )
  assert.equal(c.uso, 0)
  assert.equal(c.diferenca, 480)
  assert.equal(c.explicacao, '2h canceladas sem crédito')
})

test('mensalista comum com o mês todo cancelado não ganha ajuste de mensalidade', () => {
  const c = conciliarMensalidade(480, [
    { horas: 2, cancelada: true, valor: 240, comCredito: false },
    { horas: 2, cancelada: true, valor: 240, comCredito: false },
  ])
  assert.equal(c.ajusteSugerido, 0)
  assert.equal(
    podeAjustarMensalidadeDoProfessor({
      ...c,
      professor: false,
      rateio: false,
      planoAtivo: true,
      mensalidadeStatus: 'Pendente',
      pago: 0,
    }),
    false
  )
})
