import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule, realReact } from './helpers/load-typescript-module.mjs'

const user = { id: 'user-a', email: 'test@example.invalid', name: 'Test', role: null,
  created_at: '', onboarding_completed_at: null, onboarding_version: 0 }
const arenas = [{ id: 'arena-a', name: 'A', isOwner: true, role: 'Owner', assignedStationId: null },
  { id: 'arena-b', name: 'B', isOwner: false, role: 'Caixa', assignedStationId: 'station-b' }]

function bootstrap({ denied = false, userError = false, arenaError = false, empty = false } = {}) {
  let queries = 0
  const query = { select() { return this }, eq() { return this }, async maybeSingle() {
    queries++
    return { data: userError ? null : user, error: userError ? { message: 'unavailable' } : null }
  } }
  const loaded = loadTypescriptModule('src/lib/dashboard-bootstrap.ts', {
    '@/lib/server-auth': {
      async requireWebBackofficeAccess() { if (denied) throw new Error('Forbidden'); return { dbUserId: user.id } },
      async getPlatformAccessLevel() { return null },
    },
    '@/lib/supabase-server': { getSupabaseAdmin: () => ({ from: () => query }) },
    '@/lib/accessible-arenas': { async loadAccessibleArenas(id) {
      assert.equal(id, user.id)
      if (arenaError) throw new Error('unavailable')
      return empty ? [] : arenas
    } },
  }, { console: { error() {} } })
  return { ...loaded, queries: () => queries }
}

test('bootstrap authenticates before reading a profile and rejects forbidden access', async () => {
  const h = bootstrap({ denied: true })
  await assert.rejects(h.loadDashboardBootstrap(), /Forbidden/)
  assert.equal(h.queries(), 0)
})

test('bootstrap returns user and arenas; a genuinely empty list remains loaded', async () => {
  const data = await bootstrap({ empty: true }).loadDashboardBootstrap()
  assert.equal(data.user.id, user.id)
  assert.equal(data.user.platform_access_level, null)
  assert.equal(data.arenas.length, 0)
})

for (const options of [{ userError: true }, { arenaError: true }]) {
  test(`bootstrap preserves retry flow when an initial read fails: ${JSON.stringify(options)}`, async () => {
    const data = await bootstrap(options).loadDashboardBootstrap()
    assert.equal(data.arenas, null)
    assert.equal(data.user === null, !!options.userError)
  })
}

// Exercise provider effects with retained hook state, including explicit retry.
function providerHarness(kind, { initial = true, empty = false } = {}) {
  const slots = [], pending = [], requests = []
  let cursor = 0, failure = false, currentUser = user
  const hooks = {
    ...realReact,
    createContext: () => ({ Provider: 'Provider' }),
    useState(initialValue) {
      const index = cursor++
      if (!(index in slots)) slots[index] = initialValue
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value }]
    },
    useReducer(reducer, initialValue) {
      const [value, set] = hooks.useState(initialValue)
      return [value, action => set(current => reducer(current, action))]
    },
    useRef(value) { return hooks.useState({ current: value })[0] },
    useCallback(fn, deps) {
      const index = cursor++, previous = slots[index]
      if (!previous || deps.some((dep, i) => dep !== previous.deps[i])) slots[index] = { fn, deps }
      return slots[index].fn
    },
    useEffect(fn, deps) {
      const index = cursor++, previous = slots[index]
      if (!previous || deps.some((dep, i) => dep !== previous[i])) pending.push(fn)
      slots[index] = deps
    },
  }
  const imports = { react: hooks, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    '@/contexts/UserContext': { useDbUser: () => ({ dbUser: currentUser }) },
    'next/navigation': { usePathname: () => '/dashboard/arenas/arena-b/stations' } }
  const loaded = loadTypescriptModule(`src/contexts/${kind}Context.tsx`, imports, {
    fetch: async url => {
      requests.push(url)
      return { ok: !failure, status: failure ? 503 : 200, json: async () => kind === 'User' ? user : arenas }
    },
  })
  const props = kind === 'User' ? { initialUser: initial ? user : null }
    : { initialArenas: initial ? (empty ? [] : arenas) : null }
  async function render() {
    cursor = 0
    const tree = loaded[`${kind}Provider`]({ ...props, children: null })
    for (const fn of pending.splice(0)) await fn()
    await new Promise(resolve => setImmediate(resolve))
    return tree.props.value
  }
  return { render, requests, fail: value => { failure = value }, changeUser: value => { currentUser = value } }
}

for (const kind of ['User', 'Arena']) {
  test(`${kind} provider uses bootstrap immediately without a duplicate browser request, and supports retry`, async () => {
    const h = providerHarness(kind)
    const first = await h.render()
    assert.equal(kind === 'User' ? first.isLoading : first.isLoadingArenas, false)
    if (kind === 'Arena') {
      assert.equal(first.selectedArena, 'arena-b')
      assert.equal(first.selectedArenaDetails.assignedStationId, 'station-b')
    }
    await h.render()
    assert.equal(h.requests.length, 0)
    h.fail(true)
    await (kind === 'User' ? first.retry() : first.retryArenas())
    const failed = await h.render()
    assert.ok(kind === 'User' ? failed.error : failed.arenasError)
    h.fail(false)
    await (kind === 'User' ? failed.retry() : failed.retryArenas())
    const recovered = await h.render()
    assert.equal(kind === 'User' ? recovered.error : recovered.arenasError, null)
    assert.equal(h.requests.length, 2)
  })

  test(`${kind} provider falls back to its endpoint when bootstrap is unavailable`, async () => {
    const h = providerHarness(kind, { initial: false })
    await h.render()
    const loaded = await h.render()
    assert.equal(h.requests.length, 1)
    assert.equal(kind === 'User' ? loaded.dbUser.id : loaded.arenas.length, kind === 'User' ? user.id : 2)
  })
}

test('an empty bootstrap list is loaded, and an identity change reloads arena access', async () => {
  const h = providerHarness('Arena', { empty: true })
  const first = await h.render()
  assert.equal(first.isLoadingArenas, false)
  assert.equal(first.arenas.length, 0)
  assert.equal(h.requests.length, 0)
  h.changeUser({ ...user, id: 'different-user' })
  await h.render()
  assert.equal(h.requests.length, 1)
})

test('dashboard checks the selected tenant once and starts summary reads before courts finish', async () => {
  let authCalls = 0, guardCalls = 0, releaseCourts
  const started = []
  const courtsPending = new Promise(resolve => { releaseCourts = resolve })
  const loaded = loadTypescriptModule('src/modules/dashboard/actions/dashboardActions.ts', {
    '@/lib/accessible-arenas': {},
    '@/lib/server-auth': {
      async requireAuthenticatedDbUser() { authCalls++; return { dbUserId: user.id } },
      async assertArenaResourceAccess(id, key) {
        guardCalls++
        assert.equal(key, 'dashboard')
        if (id !== 'arena-a') throw new Error('Forbidden')
        return { dbUserId: user.id, resources: ['dashboard','spaces','finance.overview','bookings.single','bookings.recurring','athletes'] }
      },
    },
    '@/lib/supabase-server': { getSupabaseAdmin: () => ({ from(table) {
      let columns, start = ''
      return {
        select(value) { columns = value; return this }, in() { return this }, eq() { return this },
        gte(_, value) { start = value; return this }, lte() { return this }, not() { return this }, order() { return this },
        then(resolve, reject) {
          started.push(table)
          if (table === 'courts') return courtsPending.then(() => ({ data: [{ id: 'court-a', arena_id: 'arena-a', name: 'Court A',
            day_config: ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
              .map(day => ({ day, enabled: true, startTime: '08:00', endTime: '20:00' })) }], error: null })).then(resolve, reject)
          const bookingStart = new Date(); bookingStart.setHours(9, 0, 0, 0)
          const bookingEnd = new Date(bookingStart); bookingEnd.setHours(10)
          const data = columns === 'court_id, start_time, end_time'
            ? [{ court_id: 'court-a', start_time: bookingStart.toISOString(), end_time: bookingEnd.toISOString() }]
            : table === 'transactions' ? [{ total_value: new Date(start).getMonth() === new Date().getMonth() ? '150.123' : '100' }]
            : columns === 'athlete_id' ? [{ athlete_id: 'a' }, { athlete_id: 'a' }, { athlete_id: 'b' }] : []
          return Promise.resolve({ data, error: null, count: 3 }).then(resolve, reject)
        },
      }
    } }) },
    '@/lib/supabase-pagination': { fetchAllSupabaseRows: query => Promise.resolve(query) },
  })
  const pending = loaded.getDashboardDataAction('arena-a')
  await new Promise(resolve => setImmediate(resolve))
  assert.ok(started.includes('transactions'), 'revenue must not wait for the courts response')
  releaseCourts()
  const result = await pending
  assert.equal(authCalls, 0, 'arena guard already resolves the authenticated user')
  assert.equal(guardCalls, 1)
  assert.equal(result.success, true)
  assert.equal(result.stats.receita, 150.123)
  assert.equal(result.stats.reservas, 3)
  assert.equal(result.stats.ativos, 2)
  assert.equal(result.stats.quadras, 1)
  assert.equal(result.occupancy[0].booked, 1)
  assert.equal(result.occupancy[0].total, 12)
  assert.equal(result.occupancy[0].percentage, 8)
  const rejected = await loaded.getDashboardDataAction('foreign-arena')
  assert.equal(rejected.success, false)
  assert.equal(rejected.error, 'Forbidden')
})

test('aggregate revenue uses both the dashboard and finance grant of each individual arena', async () => {
  const reads = []
  let grants = ['dashboard', 'finance.overview']
  const loaded = loadTypescriptModule('src/modules/dashboard/actions/dashboardActions.ts', {
    '@/lib/server-auth': { requireAuthenticatedDbUser: async () => ({ dbUserId: user.id }) },
    '@/lib/accessible-arenas': { loadAccessibleArenas: async () => [
      { id: 'arena-a', resources: grants },
      { id: 'arena-b', resources: ['dashboard'] },
      { id: 'arena-c', resources: ['finance.overview'] },
    ] },
    '@/lib/supabase-server': { getSupabaseAdmin: () => ({ from(table) {
      assert.equal(table, 'transactions')
      return {
        select() { return this }, eq() { return this }, gte() { return this }, lte() { return this },
        in(column, ids) { assert.equal(column, 'arena_id'); reads.push([...ids]); return this },
        order() { return Promise.resolve({ data: [{ total_value: '27.50' }], error: null }) },
      }
    } }) },
    '@/lib/supabase-pagination': { fetchAllSupabaseRows: query => Promise.resolve(query) },
  })
  const before = await loaded.getDashboardDataAction('all')
  assert.equal(before.stats.receita, 27.5)
  assert.deepEqual(reads, [['arena-a'], ['arena-a']])
  grants = ['dashboard']
  const after = await loaded.getDashboardDataAction('all')
  assert.equal(after.stats.receita, 0)
  assert.equal(reads.length, 2)
})

test('mixed grants filter counts, active athletes and occupancy by each arena and booking kind', async () => {
  const kinds = ['singles','monthly','both','hidden']
  const arenaIds = kinds.map(kind => 'arena-' + kind)
  const day = new Date(); day.setHours(10,0,0,0)
  const end = new Date(day); end.setHours(11,0,0,0)
  const courts = arenaIds.map((id,i) => ({ arena_id: id, id: 'court-'+i, name: kinds[i],
    day_config: ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']
      .map(day => ({ day,enabled:true,startTime:'08:00',endTime:'20:00' })) }))
  const bookings = courts.flatMap(c => ['single','monthly'].map(kind => ({arena_id:c.arena_id, court_id:c.id,
    kind,athlete_id:c.id+'-'+kind,start_time:day.toISOString(),end_time:end.toISOString()})))
  const resources = [['bookings.single'],['bookings.recurring'],['bookings.single','bookings.recurring'],[]]
  const loaded = loadTypescriptModule('src/modules/dashboard/actions/dashboardActions.ts',{
    '@/lib/server-auth': { requireAuthenticatedDbUser: async () => ({dbUserId:'user'}) },
    '@/lib/accessible-arenas': {loadAccessibleArenas: async () => resources.map((grants,i) => ({
      id:arenaIds[i],resources:['dashboard','spaces','athletes',...grants]}))},
    '@/lib/supabase-pagination': { fetchAllSupabaseRows: q => Promise.resolve(q) },
    '@/lib/supabase-server': {getSupabaseAdmin: () => ({from(table) {
      let ids, expr,columns
      return {
        select(c) { columns=c;return this }, in(k,v){ if(k==='arena_id')ids=v;return this },
        or(e){expr=e;return this},eq(){return this},gte(){return this},lte(){return this},not(){return this},order(){return this},
        then(resolve) {
          if(table==='courts') return resolve({data:courts.filter(c=>ids.includes(c.arena_id))})
          assert.equal(table,'bookings')
          assert.ok(!ids.includes('arena-hidden'))
          const rows = bookings.filter(b=>ids.includes(b.arena_id) && (!expr ||
            (expr.includes('booking_type.neq.mensalista') ? b.kind==='single' : b.kind==='monthly')))
          resolve({data:columns==='*' ? null : rows,count:rows.length})
        },
      }
    }})},
  })
  const response = await loaded.getDashboardDataAction('all')
  assert.equal(response.success,true)
  assert.equal(response.stats.reservas,4)
  assert.equal(response.stats.ativos,4)
  assert.deepEqual(Object.fromEntries(response.occupancy.map(row=>[row.courtName,row.booked])),{monthly:1,both:2,singles:1})
})

test('athlete booking history uses the same arena, athlete and booking-kind filter as the dashboard', async () => {
  let resources
  const returned = { single:{id:'avulso',start_time:'2026-01-01'}, monthly:{id:'mensalista',start_time:'2026-01-02'} }
  const detail = loadTypescriptModule('src/modules/athletes/actions/athleteDetailsActions.ts', {
    '@/lib/server-auth': { assertArenaResourceAccess: async () => ({resources}) },
    '@/lib/supabase-server': {getSupabaseAdmin: () => ({from(table) {
      let filter
      const conditions = {}
      return {
        select(){return this},eq(key,val){conditions[key]=val;return this},order(){return this},limit(){return this},
        or(expr){filter=expr;return this},single(){return this},
        then(resolve) {
          if(table==='atleta') return resolve({data:{id:'athlete',nome_perfil:'Sócio',arenas_atleta:[]}})
          if(table!=='bookings') return resolve({data:[]})
          assert.deepEqual(conditions,{arena_id:'arena',athlete_id:'athlete'})
          if(!filter) return resolve({data:Object.values(returned)})
          resolve({data:filter.includes('booking_type.neq.mensalista') ? [returned.single] : [returned.monthly]})
        },
      }
    }})},
  })
  for(const [grants,expected] of [[[],[]],[['bookings.single'],['avulso']],[['bookings.recurring'],['mensalista']],
    [['bookings.single','bookings.recurring'],['avulso','mensalista']]]) {
    resources=['athletes',...grants]
    const response=await detail.getAthleteDetailsAction('arena','athlete')
    assert.equal(response.success,true)
    assert.deepEqual(Array.from(response.data.reservas,b=>b.id),expected)
    assert.equal(response.data.total_reservas,expected.length)
  }
})
