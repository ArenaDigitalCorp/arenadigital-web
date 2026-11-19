import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

const arena = '10000000-0000-4000-8000-000000000001'
const booking = '10000000-0000-4000-8000-000000000002'
const operation = '10000000-0000-4000-8000-000000000003'
const actor = '10000000-0000-4000-8000-000000000004'
const path = 'src/modules/bookings/actions/mensalistaActions.ts'
const time = (hour, minutes = '00') => new Date(`2026-11-19T${String(hour).padStart(2, '0')}:${minutes}:00-03:00`).toISOString()
const range = (start, end) => ({ inicio: time(start), fim: time(end) })

function tabela(id, court_id, tipo, nome) {
  return { id, court_id, tipo, nome }
}

function actions({
  type = 'hourly',
  planCourt = 'court',
  planTable = 'plan-table',
  bookingTable = null,
  priceTables = [tabela('plan-table', 'court', 'mensalista', 'Mensalista da quadra')],
  authorized = true,
} = {}) {
  const calls = [], access = [], revalidated = []
  const tables = {
    bookings: [{ id: booking, arena_id: arena, court_id: 'court', plano_mensalista_id: 'plan', price_table_id: bookingTable, start_time: time(6), end_time: time(11), courts: { booking_type: type } }],
    planos_mensalista: [{ id: 'plan', arena_id: arena, court_id: planCourt, price_table_id: planTable, athlete_name: 'Atleta teste' }],
    court_price_tables: priceTables,
  }
  const client = {
    from(name) {
      let rows = tables[name]
      const query = {
        select() { return query },
        eq(column, value) {
          rows = rows.filter(row => row[column] === value)
          return query
        },
        async single() {
          return rows.length === 1 ? { data: rows[0], error: null } : { data: null, error: { message: 'Era esperada uma linha.' } }
        },
        async maybeSingle() {
          return rows.length > 1 ? { data: null, error: { message: 'Mais de uma linha.' } } : { data: rows[0] ?? null, error: null }
        },
      }
      return query
    },
    async rpc(name, args) {
      calls.push({ name, ...args })
      if (name !== 'resolve_court_price') return { data: { partial: true, valor_credito: args.p_valor_credito }, error: null }
      if (type === 'unique') return { data: '200.00', error: null }
      const rates = new Map([[time(6), 100], [time(7), 120], [time(8), 50], [time(9), 50], [time(10), 40]])
      const hours = (Date.parse(args.p_end) - Date.parse(args.p_start)) / 3600000
      assert.ok(hours > 0 && hours <= 1)
      return { data: String(rates.get(args.p_start) * hours), error: null }
    },
  }
  const actions = loadTypescriptModule(path, {
    '@/lib/supabase-server': { getSupabaseAdmin: () => client },
    '@/lib/server-auth': {
      async assertArenaResourceAccess(id, resource) { access.push([id, resource]); if (!authorized) throw Error('Acesso negado') },
      async requireAuthenticatedDbUser() { return { dbUserId: actor } },
    },
    'next/cache': { revalidatePath: route => revalidated.push(route) },
  })
  return { ...actions, calls, access, revalidated }
}

test('cotação discrimina R$100 e R$120, ignora a lacuna e usa a tabela do plano', async () => {
  const h = actions()
  const result = await h.quoteSessaoMensalistaAction(arena, booking, [range(6, 8), range(10, 11)])
  assert.equal(result.success, true, result.error)
  assert.deepEqual(Array.from(result.data.valoresPorHorario, item => item.valor), [100, 120, 40])
  assert.deepEqual(Array.from(result.data.valoresPorTrecho, item => item.valor), [220, 40])
  assert.equal(result.data.valorSugerido, 260)
  assert.deepEqual(h.calls.map(item => item.p_start), [time(6), time(7), time(10)])
  assert.ok(h.calls.every(item => item.p_price_table_id === 'plan-table'))
})

test('plano legado sem tabela usa a mensalista da quadra ou a padrão e cota meia hora proporcionalmente', async () => {
  for (const fallback of ['mensalista', null]) {
    const priceTables = [tabela('errada', 'outra-quadra', 'mensalista', 'Tabela de outra quadra')]
    if (fallback) priceTables.push(tabela(fallback, 'court', 'mensalista', 'Mensalista da quadra'))
    const h = actions({ planCourt: 'outra-quadra', planTable: null, priceTables })
    const result = await h.quoteSessaoMensalistaAction(arena, booking, { inicio: time(7), fim: time(7, '30') })
    assert.equal(result.success, true, result.error)
    assert.equal(result.data.valorSugerido, 60)
    assert.equal(result.data.origem, fallback ?? 'padrao')
    assert.equal(h.calls[0].p_price_table_id, fallback)
  }
})

test('o tipo mensalista do plano admite a tabela padrão quando a segunda quadra não possui mensalista', async () => {
  const h = actions({
    planCourt: 'primeira-quadra',
    planTable: 'mensalista-origem',
    priceTables: [tabela('mensalista-origem', 'primeira-quadra', 'mensalista', 'Mensalidade')],
  })
  const quote = await h.quoteSessaoMensalistaAction(arena, booking, range(6, 7))
  assert.equal(quote.success, true, quote.error)
  assert.equal(quote.data.origem, 'padrao')
  assert.deepEqual(h.calls.map(call => call.p_price_table_id), [null])
})

test('plano de professor sem snapshot na segunda quadra usa a tabela de professor da quadra da reserva', async () => {
  const h = actions({
    planCourt: 'primeira-quadra',
    planTable: 'professor-origem',
    priceTables: [
      tabela('professor-origem', 'primeira-quadra', 'professor', 'Treino'),
      tabela('mensalista-destino', 'court', 'mensalista', 'Professor comercial'),
      tabela('professor-destino', 'court', 'professor', 'Treino local'),
    ],
  })
  const quote = await h.quoteSessaoMensalistaAction(arena, booking, range(6, 8))
  assert.equal(quote.success, true, quote.error)
  assert.equal(quote.data.tabelaNome, 'Treino local')
  assert.deepEqual(h.calls.map(call => [call.p_start, call.p_court_id, call.p_price_table_id]), [
    [time(6), 'court', 'professor-destino'], [time(7), 'court', 'professor-destino'],
  ])
})

test('snapshot específico da reserva na segunda quadra prevalece sobre o tipo do plano', async () => {
  const h = actions({
    planCourt: 'primeira-quadra',
    planTable: 'professor-origem',
    bookingTable: 'contrato-local',
    priceTables: [
      tabela('professor-origem', 'primeira-quadra', 'professor', 'Treino'),
      tabela('professor-destino', 'court', 'professor', 'Treino local'),
      tabela('contrato-local', 'court', 'custom', 'Contrato do bloco'),
    ],
  })
  const quote = await h.quoteSessaoMensalistaAction(arena, booking, range(7, 8))
  assert.equal(quote.success, true, quote.error)
  assert.equal(quote.data.tabelaNome, 'Contrato do bloco')
  assert.deepEqual(h.calls.map(call => call.p_price_table_id), ['contrato-local'])
})

test('tabela personalizada na primeira quadra sem snapshot da reserva na segunda deixa a cotação indisponível', async () => {
  const h = actions({
    planCourt: 'primeira-quadra',
    planTable: 'contrato-origem',
    priceTables: [
      tabela('contrato-origem', 'primeira-quadra', 'custom', 'Contrato'),
      tabela('outro-contrato', 'court', 'custom', 'Contrato'),
      tabela('mensalista-destino', 'court', 'mensalista', 'Mensalista local'),
    ],
  })
  const quote = await h.quoteSessaoMensalistaAction(arena, booking, range(7, 8))
  assert.equal(quote.success, false)
  assert.match(quote.error, /tabela/i)
  assert.match(quote.error, /manual/i)
  assert.deepEqual(h.calls, [])
})

test('professor sem tabela equivalente na segunda quadra não usa a tarifa de mensalista', async () => {
  const h = actions({
    planCourt: 'primeira-quadra',
    planTable: 'professor-origem',
    priceTables: [
      tabela('professor-origem', 'primeira-quadra', 'professor', 'Treino'),
      tabela('mensalista-destino', 'court', 'mensalista', 'Mensalista local'),
    ],
  })
  const quote = await h.quoteSessaoMensalistaAction(arena, booking, range(6, 7))
  assert.equal(quote.success, false)
  assert.match(quote.error, /manual/i)
  assert.deepEqual(h.calls, [])
})

test('preço fixo em faixas separadas informa a tarifa integral sem sugerir créditos automáticos', async () => {
  const h = actions({ type: 'unique' })
  const result = await h.quoteSessaoMensalistaAction(arena, booking, [range(7, 8), range(10, 11)])
  assert.equal(result.success, true, result.error)
  assert.equal(result.data.valorSugerido, null)
  assert.equal(result.data.valorFixoReserva, 200)
  assert.equal(result.data.valoresPorTrecho.length, 0)
  assert.equal(result.data.valoresPorHorario.length, 0)
  assert.deepEqual(h.calls.map(item => [item.p_start, item.p_end]), [[time(6), time(11)]])
  const full = await h.quoteSessaoMensalistaAction(arena, booking)
  assert.equal(full.data.valorSugerido, 200)
})

test('cada trecho é gravado pelo valor confirmado numa única chamada, inclusive o trecho sem crédito', async () => {
  const h = actions()
  const payload = {
    arenaId: arena, bookingId: booking, operationId: operation, lancarCredito: true,
    valorCredito: 117.35, descricao: 'Acordo',
    intervalos: [
      { ...range(7, 8), valorCredito: 117.35, descricao: 'Faixa da manhã' },
      { ...range(10, 11), valorCredito: 0, descricao: '' },
    ],
  }
  const saved = await h.cancelarSessaoMensalistaAction(payload)
  assert.equal(saved.success, true, saved.error)
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].name, 'cancel_mensalista_booking_ranges_atomic')
  assert.equal(h.calls[0].p_registered_by, actor)
  assert.deepEqual(Array.from(h.calls[0].p_intervalos, i => [i.inicio, i.fim, i.valor_credito, i.descricao]),
    [[time(7), time(8), 117.35, 'Faixa da manhã'], [time(10), time(11), 0, null]])
  assert.deepEqual(h.access, [[arena, 'bookings.recurring']])
  assert.ok(h.revalidated.includes(`/dashboard/arenas/${arena}/mensalistas`))
  for (const invalid of [{ valorCredito: 120 }, { intervalos: [] }, { lancarCredito: false }]) {
    assert.equal((await h.cancelarSessaoMensalistaAction({ ...payload, ...invalid })).success, false)
  }
  assert.equal(h.calls.length, 1)
  const denied = actions({ authorized: false })
  assert.equal((await denied.cancelarSessaoMensalistaAction(payload)).success, false)
  assert.equal(denied.calls.length, 0)
})

test('uma aba antiga pode cancelar um único trecho sem lançar crédito', async () => {
  const h = actions()
  const saved = await h.cancelarSessaoMensalistaAction({
    arenaId: arena, bookingId: booking, operationId: operation, lancarCredito: false,
    valorCredito: 120, descricao: '', cancelInicio: time(7), cancelFim: time(8),
  })
  assert.equal(saved.success, true, saved.error)
  assert.equal(h.calls[0].name, 'cancel_mensalista_booking_partial_atomic')
  assert.equal(h.calls[0].p_valor_credito, 0)
})
