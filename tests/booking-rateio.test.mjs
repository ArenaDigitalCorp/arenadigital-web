import assert from 'node:assert/strict'
import { register } from 'node:module'
import test from 'node:test'

// avulsos-list.ts importa booking-rateio.ts via alias `@/` (resolvido pelo
// bundler). Aqui o alias é mapeado para `src/` só dentro deste teste.
const srcRoot = new URL('../src/', import.meta.url).href
register(
  'data:text/javascript,' +
    encodeURIComponent(`
      export async function resolve(specifier, context, next) {
        if (specifier.startsWith('@/')) {
          return next(${JSON.stringify(srcRoot)} + specifier.slice(2) + '.ts', context)
        }
        return next(specifier, context)
      }
    `)
)

const {
  dividirIgualmente,
  diferencaRateio,
  locacaoDoRateio,
  parteLocacao,
  restanteDoAtletaNoRateio,
  resumoRateio,
  sortCobrancas,
  toBookingCobranca,
  valorRateioNoRelatorio,
} = await import('../src/modules/bookings/lib/booking-rateio.ts')
const { buildAvulsoItem, matchesAvulsoSearch, resumoAvulsos } = await import(
  '../src/modules/finance/lib/avulsos-list.ts'
)

const cobranca = (over) =>
  toBookingCobranca({
    id: over.id ?? 'c',
    atleta_id: null,
    nome: 'Pessoa',
    responsavel: false,
    valor_devido: 0,
    valor_servicos: 0,
    valor_pago: 0,
    status: 'aberto',
    pago_em: null,
    ...over,
  })

test('divisão igual fecha o total em centavos, sobra no responsável', () => {
  assert.deepEqual(dividirIgualmente(100, 3), [33.34, 33.33, 33.33])
  assert.deepEqual(dividirIgualmente(90, 2), [45, 45])
  assert.equal(
    dividirIgualmente(100, 3).reduce((s, v) => s + v, 0).toFixed(2),
    '100.00'
  )
  assert.deepEqual(dividirIgualmente(50, 0), [])
})

test('diferença entre as partes livres e a locação', () => {
  assert.equal(diferencaRateio([40, 30, 30], 100), 0)
  assert.equal(diferencaRateio([40, 30], 100), -30)
  assert.equal(diferencaRateio([60, 60], 100), 20)
  assert.equal(diferencaRateio([Number.NaN, 50], 100), -50)
})

test('parte da locação desconta os serviços do responsável', () => {
  assert.equal(parteLocacao({ valor_devido: 60, valor_servicos: 20 }), 40)
  assert.equal(parteLocacao({ valor_devido: 30, valor_servicos: 0 }), 30)
})

test('normaliza numeric do banco e ordena com o responsável primeiro', () => {
  const c = toBookingCobranca({
    id: 'x', atleta_id: null, nome: 'Zé', responsavel: false,
    valor_devido: '30.00', valor_servicos: '0', valor_pago: '10.5', status: 'parcial', pago_em: null,
  })
  assert.equal(c.valor_devido, 30)
  assert.equal(c.valor_pago, 10.5)
  assert.equal(c.status, 'parcial')

  const ordenadas = sortCobrancas([
    cobranca({ id: '1', nome: 'Bia' }),
    cobranca({ id: '2', nome: 'Ana', responsavel: true }),
    cobranca({ id: '3', nome: 'Ana Clara' }),
  ])
  assert.deepEqual(ordenadas.map((x) => x.id), ['2', '3', '1'])
})

test('resumo do rateio considera pagamentos parciais', () => {
  const resumo = resumoRateio([
    cobranca({ valor_devido: 60, valor_pago: 60, status: 'quitado' }),
    cobranca({ valor_devido: 30, valor_pago: 10, status: 'parcial' }),
    cobranca({ valor_devido: 30 }),
  ])
  assert.deepEqual(resumo, { devido: 120, pago: 70, restante: 50, pessoas: 3, quitadas: 1 })
})

test('relatório: pendente mostra o que falta, pago mostra o total das partes', () => {
  const partes = [
    { valor_devido: 50, valor_pago: 20 },
    { valor_devido: 50, valor_pago: 0 },
  ]
  assert.equal(valorRateioNoRelatorio('reservado', partes), 80)
  assert.equal(valorRateioNoRelatorio('confirmed', partes), 100)
})

test('dívida do atleta no rateio é só a parte dele que falta', () => {
  const partes = [
    { atleta_id: 'ana', valor_devido: 50, valor_pago: 20 },
    { atleta_id: null, valor_devido: 50, valor_pago: 0 },
  ]
  assert.equal(restanteDoAtletaNoRateio('ana', partes), 30)
  assert.equal(restanteDoAtletaNoRateio('bia', partes), 0)
})

const bookingRow = (over) => ({
  id: 'b1',
  start_time: '2046-02-10T10:00:00Z',
  end_time: '2046-02-10T11:00:00Z',
  price: 50,
  status: 'reservado',
  athlete_name: 'Ana',
  cobranca_por_participante: false,
  atleta: [{ id: 'ana', nome_perfil: 'Ana', telefone: null }],
  court: { id: 'q1', name: 'Quadra 1' },
  sports: null,
  booking_cobrancas: [],
  ...over,
})

test('reserva sem rateio: uma cobrança única com o valor da reserva', () => {
  const pendente = buildAvulsoItem(bookingRow({ price: '80.00' }))
  assert.equal(pendente.rateio, false)
  assert.equal(pendente.valor_total, 80)
  assert.equal(pendente.restante, 80)
  assert.equal(pendente.atleta?.nome_perfil, 'Ana')

  const pago = buildAvulsoItem(bookingRow({ status: 'confirmed', price: 80 }))
  assert.equal(pago.status, 'pago')
  assert.equal(pago.valor_pago, 80)
  assert.equal(pago.restante, 0)
})

test('reserva com rateio usa as partes, não o price legado por pessoa', () => {
  const item = buildAvulsoItem(
    bookingRow({
      price: 50, // legado: valor por pessoa
      cobranca_por_participante: true,
      booking_cobrancas: [
        { id: 'c2', atleta_id: null, nome: 'João', responsavel: false, valor_devido: '50', valor_servicos: 0, valor_pago: '20', status: 'parcial', pago_em: null },
        { id: 'c1', atleta_id: 'ana', nome: 'Ana', responsavel: true, valor_devido: '50', valor_servicos: 0, valor_pago: '50', status: 'quitado', pago_em: '2046-02-01' },
      ],
    })
  )
  assert.equal(item.rateio, true)
  assert.equal(item.valor_total, 100)
  assert.equal(item.valor_pago, 70)
  assert.equal(item.restante, 30)
  assert.deepEqual(item.cobrancas.map((c) => c.nome), ['Ana', 'João'])

  assert.equal(matchesAvulsoSearch(item, 'joã'), true)
  assert.equal(matchesAvulsoSearch(item, 'quadra 1'), true)
  assert.equal(matchesAvulsoSearch(item, 'carlos'), false)

  const cancelada = buildAvulsoItem(
    bookingRow({ status: 'cancelled', cobranca_por_participante: true, booking_cobrancas: [] })
  )
  assert.equal(cancelada.status, 'cancelado')
  assert.equal(cancelada.restante, 0)
})

test('cards: pendentes, a receber e recebido (inclui parciais), sem canceladas', () => {
  const items = [
    buildAvulsoItem(bookingRow({ id: 'a', price: 80 })),
    buildAvulsoItem(bookingRow({ id: 'b', status: 'confirmed', price: 60 })),
    buildAvulsoItem(bookingRow({ id: 'c', status: 'cancelled', price: 99 })),
    buildAvulsoItem(
      bookingRow({
        id: 'd',
        cobranca_por_participante: true,
        booking_cobrancas: [
          { id: 'x', atleta_id: null, nome: 'Zé', responsavel: true, valor_devido: 40, valor_servicos: 0, valor_pago: 15, status: 'parcial', pago_em: null },
        ],
      })
    ),
  ]
  assert.deepEqual(resumoAvulsos(items), { pendentes: 2, aReceber: 105, pagas: 1, recebido: 75 })
})

test('locação do rateio: reserva nova usa rental_price, legada usa a soma das partes', () => {
  const partes = [
    { valor_devido: 60, valor_servicos: 20 },
    { valor_devido: 30, valor_servicos: 0 },
    { valor_devido: 30, valor_servicos: 0 },
  ]
  // novo modelo: price = soma das partes (120), locação digitada 100
  assert.equal(locacaoDoRateio({ price: 120, rental_price: 100 }, partes), 100)
  // legado: price/rental_price = valor por pessoa (50), duas partes de 50
  const legado = [
    { valor_devido: 50, valor_servicos: 0 },
    { valor_devido: 50, valor_servicos: 0 },
  ]
  assert.equal(locacaoDoRateio({ price: '50.00', rental_price: '50.00' }, legado), 100)
  // sem partes ainda: cai no valor da reserva
  assert.equal(locacaoDoRateio({ price: 80, rental_price: null }, []), 80)
})
