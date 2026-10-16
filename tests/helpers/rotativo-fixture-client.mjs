// In-memory backend fixture. No network, database or real financial operations.
export const fixtureArena = 'f1000000-0000-4000-8000-000000000001'
export const fixtureOtherArena = 'f2000000-0000-4000-8000-000000000002'
export const fixtureAthlete = 'f3000000-0000-4000-8000-000000000003'

export function rotativoFixture({ gated = false } = {}) {
  const events = [], rpcCalls = []
  let release
  const gate = gated ? new Promise(resolve => { release = resolve }) : Promise.resolve()
  const state = {
    failure: null,
    lots: [
      { id: 'expired', arena_id: fixtureArena, atleta_id: fixtureAthlete, quantidade_restante: 5, data_vencimento: '2000-01-01' },
      { id: 'valid', arena_id: fixtureArena, atleta_id: fixtureAthlete, quantidade_restante: 3, data_vencimento: '2999-12-31' },
      { id: 'other-valid', arena_id: fixtureOtherArena, atleta_id: fixtureAthlete, quantidade_restante: 4, data_vencimento: '2999-12-31' },
    ],
    movements: [],
  }
  function rows(table) {
    if (table === 'rotativo_credito_lotes') return state.lots
    if (table === 'rotativo_credito_movimentos') return state.movements
    if (table === 'rotativo_credito_saldo') return [fixtureArena, fixtureOtherArena].map(arena_id => ({
      arena_id, atleta_id: fixtureAthlete,
      saldo: state.lots.filter(lot => lot.arena_id === arena_id).reduce((sum, lot) => sum + lot.quantidade_restante, 0),
    }))
    if (table === 'atleta') return [{ id: fixtureAthlete, nome_perfil: 'Fixture Athlete' }]
    return []
  }
  function query(table) {
    const filters = [], orders = []
    let start = 0, end = Infinity, single = false
    const builder = {
      select() { return builder },
      eq(key, value) { filters.push(row => row[key] === value); return builder },
      gt(key, value) { filters.push(row => row[key] > value); return builder },
      in(key, values) { filters.push(row => values.includes(row[key])); return builder },
      order(key, { ascending = true } = {}) { orders.push({ key, ascending }); return builder },
      range(from, to) { start = from; end = to; return builder },
      limit(value) { end = value - 1; return builder },
      maybeSingle() { single = true; return builder },
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          events.push({ type: 'read', table })
          let data = rows(table).filter(row => filters.every(filter => filter(row)))
          const count = data.length
          data.sort((a, b) => {
            for (const { key, ascending } of orders) {
              const comparison = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0
              if (comparison) return ascending ? comparison : -comparison
            }
            return 0
          })
          data = data.slice(start, end + 1).map(row => ({ ...row }))
          return { data: single ? data[0] ?? null : data, error: null, count }
        }).then(resolve, reject)
      },
    }
    return builder
  }
  const client = {
    from: query,
    rpc(name, input) {
      if (name !== 'expire_backoffice_rotativo_credits') throw new Error('Unexpected fixture RPC')
      rpcCalls.push(input.p_arena_id)
      events.push({ type: 'expiry.start', arenaId: input.p_arena_id })
      if (state.failure === 'throw') throw new Error('Fixture expiry unavailable')
      return gate.then(() => {
        if (state.failure === 'error') return { data: null, error: { message: 'Fixture expiry unavailable' } }
        let processed = 0
        for (const lot of state.lots) {
          if (lot.arena_id !== input.p_arena_id || lot.data_vencimento !== '2000-01-01' || lot.quantidade_restante <= 0) continue
          state.movements.push({ id: `expiry-${lot.id}`, arena_id: lot.arena_id, atleta_id: lot.atleta_id,
            tipo: 'vencimento', quantidade: -lot.quantidade_restante, lote_id: lot.id, inscricao_id: null, created_at: '2026-10-16T12:00:00Z' })
          lot.quantidade_restante = 0
          processed++
        }
        events.push({ type: 'expiry.complete', arenaId: input.p_arena_id })
        return { data: processed, error: null }
      })
    },
  }
  return { client, state, events, rpcCalls, release: () => release?.() }
}
