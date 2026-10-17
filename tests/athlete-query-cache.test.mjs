import assert from 'node:assert/strict'
import test from 'node:test'
import { QueryObserver, queryOptions } from '@tanstack/react-query'
import { loadTypescriptModule, realReact } from './helpers/load-typescript-module.mjs'

const userId = 'f1000000-0000-4000-8000-000000000001'
const arenaId = 'f2000000-0000-4000-8000-000000000001'
const otherId = 'f3000000-0000-4000-8000-000000000001'
const scope = { userId, arenaId, tutorial: false }
const query = { page: 1, pageSize: 25, search: '', profile: 'todos', sort: { column: 'name', direction: 'asc' } }
const page = (number = 1) => ({ items: [{ id: `athlete-${number}`, perfil: 'professor' }],
  page: number, pageSize: 25, total: 75, counts: { todos: 75, professor: 1 }, profilesAvailable: true })

function harness(t, fetcher) {
  const calls = []
  const cache = loadTypescriptModule('src/modules/athletes/lib/athlete-query-cache.ts', {}, {
    fetch: async (url, options) => {
      calls.push({ url: new URL(url, 'https://test.invalid'), options })
      return fetcher ? fetcher(url, options) : { ok: true, status: 200, json: async () => ({ success: true,
        data: page(JSON.parse(options.body).page) }) }
    },
  })
  const client = cache.createAthleteQueryClient()
  t.after(() => client.clear())
  return { ...cache, client, calls }
}

test('page 1 → 2 → 1 reuses results; next-page prefetch is reused by the foreground read', async t => {
  const h = harness(t)
  const first = h.athletePageOptions(scope, query), second = h.athletePageOptions(scope, { ...query, page: 2 })
  await h.client.fetchQuery(first)
  await h.client.prefetchQuery(second)
  assert.equal((await h.client.fetchQuery(second)).page, 2)
  assert.equal((await h.client.fetchQuery(first)).page, 1)
  assert.equal(h.calls.length, 2)
  assert.equal(h.calls[0].url.search, '')
  assert.equal(h.calls[0].options.method, 'POST')
  assert.equal(h.calls[0].options.cache, 'no-store')
  assert.equal(h.calls[0].options.credentials, 'same-origin')
  assert.ok(h.calls[0].options.signal instanceof AbortSignal)
})

test('all identity, arena, mode, pagination, search, filter and ordering dimensions isolate the cache', async t => {
  const h = harness(t)
  const keys = [h.athletePageKey(scope, query),
    h.athletePageKey({ ...scope, userId: otherId }, query),
    h.athletePageKey({ ...scope, arenaId: otherId }, query),
    h.athletePageKey({ ...scope, tutorial: true }, query),
    ...[{ page: 2 }, { pageSize: 50 }, { search: 'Alguém' }, { profile: 'professor' },
      { sort: { column: 'sport', direction: 'asc' } }, { sort: { column: 'name', direction: 'desc' } }]
      .map(change => h.athletePageKey(scope, { ...query, ...change }))]
  assert.equal(new Set(keys.map(key => JSON.stringify(key))).size, keys.length)
  assert.equal(JSON.stringify(h.athletePageKey(scope, { ...query, search: ' abc ' })),
    JSON.stringify(h.athletePageKey(scope, { ...query, search: 'abc' })))
})

test('only the authenticated browser client has its own memory cache; an expired entry reads again', async t => {
  const h = harness(t), options = h.athletePageOptions(scope, query)
  await h.client.fetchQuery(options)
  const secondClient = h.createAthleteQueryClient()
  t.after(() => secondClient.clear())
  assert.equal(secondClient.getQueryData(options.queryKey), undefined)
  h.client.setQueryData(options.queryKey, page(), { updatedAt: Date.now() - h.ATHLETE_STALE_MS - 1 })
  await h.client.fetchQuery(options)
  assert.equal(h.calls.length, 2)
})

test('overlapping requests deduplicate; cancelling an unused read aborts it and discards a late response', async t => {
  let release
  const h = harness(t, () => new Promise(resolve => { release = resolve }))
  const options = h.athletePageOptions(scope, query)
  const first = h.client.fetchQuery(options), concurrent = h.client.fetchQuery(options)
  const rejected = Promise.allSettled([first, concurrent])
  assert.equal(h.calls.length, 1)
  await h.client.cancelQueries({ queryKey: options.queryKey })
  assert.equal(h.calls[0].options.signal.aborted, true)
  release({ ok: true, json: async () => ({ success: true, data: page() }) })
  assert.ok((await rejected).every(result => result.status === 'rejected'))
  assert.equal(h.client.getQueryData(options.queryKey), undefined)
})

test('mutation invalidation covers every page/filter in that arena, cancels old prefetch and preserves other arenas', async t => {
  const h = harness(t)
  const first = h.athletePageOptions(scope, query)
  const filtered = h.athletePageOptions(scope, { ...query, page: 2, profile: 'professor' })
  const foreign = h.athletePageOptions({ ...scope, arenaId: otherId }, query)
  await Promise.all([h.client.fetchQuery(first), h.client.fetchQuery(filtered), h.client.fetchQuery(foreign)])
  await h.invalidateArenaAthletes(h.client, arenaId)
  assert.equal(h.client.getQueryState(first.queryKey).isInvalidated, true)
  assert.equal(h.client.getQueryState(filtered.queryKey).isInvalidated, true)
  assert.equal(h.client.getQueryState(foreign.queryKey).isInvalidated, false)
  await h.client.fetchQuery(first)
  assert.equal(h.calls.length, 4)
})

for (const status of [401, 403, 409, 500]) {
  test(`HTTP ${status} remains an error, is not retried automatically, and access denial discards other pages`, async t => {
    const h = harness(t, async () => ({ ok: false, status, json: async () => ({ success: false, error: 'Denied' }) }))
    const options = h.athletePageOptions(scope, query), other = h.athletePageOptions(scope, { ...query, page: 2 })
    h.client.setQueryData(other.queryKey, page(2))
    await assert.rejects(h.client.fetchQuery(options), /Denied/)
    assert.equal(h.calls.length, 1)
    assert.equal(h.client.getQueryData(other.queryKey) === undefined, status !== 500)
  })
}

test('clearing a session cancels pending pages and a late response cannot refill the old cache', async t => {
  let release
  const h = harness(t, () => new Promise(resolve => { release = resolve }))
  const promise = h.client.fetchQuery(h.athletePageOptions(scope, query))
  const settled = promise.catch(() => {})
  h.client.clear()
  release({ ok: true, json: async () => ({ success: true, data: page() }) })
  await settled
  assert.equal(h.calls[0].options.signal.aborted, true)
  assert.equal(h.client.getQueryCache().getAll().length, 0)
})

test('a late denial from the arena left behind cannot block or clear the newly selected arena', async t => {
  let release, accessBlocks = 0
  const h = harness(t, async (_, options) => {
    if (JSON.parse(options.body).arenaId === arenaId) return new Promise(resolve => { release = resolve })
    return { ok: true, status: 200, json: async () => ({ success: true, data: page() }) }
  })
  const client = h.createAthleteQueryClient(() => { accessBlocks++ })
  const observer = new QueryObserver(client, h.athletePageOptions(scope, query))
  const unsubscribe = observer.subscribe(() => {})
  t.after(() => { unsubscribe(); observer.destroy(); client.clear() })
  assert.equal(h.calls.length, 1)
  const next = h.athletePageOptions({ ...scope, arenaId: otherId }, query)
  observer.setOptions(next)
  assert.equal(h.calls[0].options.signal.aborted, true)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(observer.getCurrentResult().isSuccess, true)

  release({ ok: false, status: 403, json: async () => ({ success: false, error: 'Forbidden' }) })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(accessBlocks, 0)
  assert.equal(observer.getCurrentResult().isSuccess, true)
  assert.equal(client.getQueryData(next.queryKey).items[0].id, 'athlete-1')
  assert.equal(h.calls.length, 2)
})

test('403 after cached success remains an error for the active observer', async t => {
  const h = harness(t, async () => ({ ok: false, status: 403, json: async () => ({ success: false, error: 'Forbidden' }) }))
  const options = h.athletePageOptions(scope, query)
  h.client.setQueryData(options.queryKey, page())
  const observer = new QueryObserver(h.client, { ...options, enabled: false })
  const unsubscribe = observer.subscribe(() => {})
  await observer.refetch()
  assert.equal(observer.getCurrentResult().isError, true)
  unsubscribe(); observer.destroy()
})

test('read-only POST validates params, authorization and expected identity before reading paginated data; every response is private/no-store', async () => {
  let reads = 0, deniedStatus = null
  class AuthorizationError extends Error { constructor(status) { super('Denied'); this.status = status } }
  const { POST } = loadTypescriptModule('src/app/api/athletes/page/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, ...options, status: options?.status ?? 200 }) } },
    '@/lib/server-auth': { AuthorizationError, async assertArenaBackofficeAccess(id) {
      assert.equal(id, arenaId)
      if (deniedStatus) throw new AuthorizationError(deniedStatus)
      return { dbUserId: userId }
    } },
    '@/lib/supabase-server': { getSupabaseAdmin: () => ({}) },
    '@/modules/athletes/lib/athlete-page': {
      ...loadTypescriptModule('src/modules/athletes/lib/athlete-page.ts'),
      async fetchAthletePage(_, id, input) { reads++; assert.equal(id, arenaId); assert.equal(input.pageSize, 25); return page() },
    },
  })
  const url = new URL('https://test.invalid/api/athletes/page')
  const input = { userId, arenaId, ...query }
  const request = () => new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
  const success = await POST(request())
  assert.equal(success.status, 200); assert.equal(reads, 1)
  input.userId = otherId
  assert.equal((await POST(request())).status, 409); assert.equal(reads, 1)
  input.userId = userId
  for (const status of [401, 403]) { deniedStatus = status; assert.equal((await POST(request())).status, status) }
  assert.equal(reads, 1)
  deniedStatus = null; input.pageSize = 1900
  const invalid = await POST(request())
  assert.equal(invalid.status, 400); assert.equal(reads, 1)
  const crossOrigin = await POST(new Request(url, { method: 'POST', headers: { Origin: 'https://foreign.invalid' }, body: JSON.stringify({ userId, arenaId, ...query }) }))
  assert.equal(crossOrigin.status, 403); assert.equal(reads, 1)
  for (const response of [success, invalid]) {
    assert.equal(response.headers['Cache-Control'], 'private, no-store')
    assert.equal(response.headers.Vary, 'Cookie')
  }
})

test('provider blocks logout, account switch and denied prefetch, but preserves normal same-user auth refreshes', () => {
  for (const [event, nextUserId, blocked] of [
    ['SIGNED_OUT', null, true], ['SIGNED_IN', 'auth-b', true], ['ACCESS_DENIED', null, true],
    ['SIGNED_IN', 'auth-a', false], ['TOKEN_REFRESHED', 'auth-a', false], ['USER_UPDATED', 'auth-a', false],
  ]) {
    const state = [], effects = [], refs = []
    let cursor = 0, refCursor = 0, callback
    const react = { ...realReact,
      useState(initial) { const i = cursor++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial
        return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next }] },
      useRef(initial) { const i = refCursor++; return refs[i] ??= { current: initial } },
      useEffect(fn) { effects.push(fn) },
    }
    const cache = loadTypescriptModule('src/modules/athletes/lib/athlete-query-cache.ts')
    const { DashboardQueryProvider } = loadTypescriptModule('src/components/dashboard/DashboardQueryProvider.tsx', {
      react, '@/contexts/UserContext': { useDbUser: () => ({ dbUser: { id: userId } }) },
      'next/navigation': { usePathname: () => `/dashboard/athletes/${arenaId}` },
      '@/modules/athletes/lib/athlete-query-cache': cache,
      '@/lib/supabase/browser': { createSupabaseBrowserClient: () => ({ auth: { onAuthStateChange(fn) {
        callback = fn; return { data: { subscription: { unsubscribe() {} } } }
      } } }) },
    }, { window: new EventTarget() })
    const wrapper = DashboardQueryProvider({ children: 'private' })
    const first = wrapper.type(wrapper.props)
    const cleanups = effects.splice(0).map(fn => fn())
    const client = first.props.client
    client.setQueryData(['private'], { secret: true })
    client.setQueryData([cache.ATHLETE_QUERY_ROOT, userId, arenaId], page())
    callback('INITIAL_SESSION', { user: { id: 'auth-a' } })
    if (event === 'ACCESS_DENIED') client.getQueryCache().config.onError(new cache.AthletePageRequestError('Forbidden', 403))
    else callback(event, nextUserId ? { user: { id: nextUserId } } : null)
    assert.equal(client.getQueryCache().getAll().length, blocked ? 0 : 2, event)
    if (event === 'USER_UPDATED') assert.equal(client.getQueryState([cache.ATHLETE_QUERY_ROOT, userId, arenaId]).isInvalidated, true)
    cursor = refCursor = 0
    const expired = wrapper.type(wrapper.props)
    assert.equal(expired.type === 'p', blocked, event)
    for (const cleanup of cleanups) cleanup?.()
    client.clear()
  }
})


test('cache policy has a bounded lifetime; unavailable profiles remain stale and tutorial stays local', async t => {
  const h = harness(t)
  const actual = loadTypescriptModule('src/modules/athletes/lib/athlete-query-cache.ts')
  const options = actual.athletePageOptions(scope, query)
  assert.equal(options.gcTime, Infinity, 'SSR must not retain per-render instances with timers')
  const browserCache = loadTypescriptModule('src/modules/athletes/lib/athlete-query-cache.ts', {}, { window: {} })
  assert.equal(browserCache.athletePageOptions(scope, query).gcTime, 60_000)
  assert.equal(options.staleTime({ state: { data: page() } }), 30_000)
  assert.equal(options.staleTime({ state: { data: { ...page(), profilesAvailable: false } } }), 0)
  assert.equal(options.refetchIntervalInBackground, false)
  assert.equal(options.networkMode, 'online')
  assert.equal(actual.athletePageOptions({ ...scope, tutorial: true }, query).networkMode, 'always')
  await h.client.fetchQuery(h.athletePageOptions({ ...scope, tutorial: true }, query))
  assert.equal(h.calls.length, 0)
})

test('optional cross-tab channel failure never converts a successful mutation into an error', () => {
  const events = []
  const { notifyAthletesChanged, openAthletesCacheChannel } = loadTypescriptModule('src/modules/athletes/lib/athlete-cache-events.ts', {}, {
    window: { dispatchEvent: event => events.push(event) }, CustomEvent,
    BroadcastChannel: class { constructor() { throw new Error('Blocked by privacy settings') } },
  })
  assert.equal(openAthletesCacheChannel(), null)
  assert.doesNotThrow(() => notifyAthletesChanged(arenaId))
  assert.equal(events[0].detail, arenaId)
})


test('invalidation aborts a pending prefetch and discards its late pre-mutation result', async t => {
  let release
  const h = harness(t, () => new Promise(resolve => { release = resolve }))
  const options = h.athletePageOptions(scope, { ...query, page: 2 })
  const prefetch = h.client.prefetchQuery(options)
  await h.invalidateArenaAthletes(h.client, arenaId)
  assert.equal(h.calls[0].options.signal.aborted, true)
  release({ ok: true, json: async () => ({ success: true, data: page(2) }) })
  await prefetch
  assert.equal(h.client.getQueryData(options.queryKey), undefined)
})

test('same-tab mutation notifies locally once; cross-tab message carries only arena and ephemeral sender', () => {
  let posted, closed = false
  const events = []
  const cacheEvents = loadTypescriptModule('src/modules/athletes/lib/athlete-cache-events.ts', {}, {
    window: { dispatchEvent: event => events.push(event) }, CustomEvent,
    BroadcastChannel: class { postMessage(message) { posted = message } close() { closed = true } },
  })
  cacheEvents.notifyAthletesChanged(arenaId)
  assert.equal(events.length, 1)
  assert.equal(posted.arenaId, arenaId)
  assert.equal(posted.source, cacheEvents.ATHLETES_CACHE_SOURCE)
  assert.deepEqual(Object.keys(posted).sort(), ['arenaId', 'source'])
  assert.equal(closed, true)
})

test('provider receives local/cross-tab changes once per source, isolates arenas and releases listeners on unmount', async t => {
  const h = harness(t), effects = []
  const target = new EventTarget()
  const channels = []
  let closed = false, receivedChanges = 0
  const cacheEvents = loadTypescriptModule('src/modules/athletes/lib/athlete-cache-events.ts', {}, {
    window: target, CustomEvent,
    BroadcastChannel: class {
      constructor() { channels.push(this) }
      close() { closed = true }
    },
  })
  const { DashboardQueryProvider } = loadTypescriptModule('src/components/dashboard/DashboardQueryProvider.tsx', {
    react: { ...realReact,
      useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
      useRef: initial => ({ current: initial }), useEffect: fn => effects.push(fn),
    },
    '@/contexts/UserContext': { useDbUser: () => ({ dbUser: { id: userId } }) },
    'next/navigation': { usePathname: () => `/dashboard/athletes/${arenaId}` },
    '@/modules/athletes/lib/athlete-query-cache': { ...h, invalidateArenaAthletes(...args) {
      receivedChanges++
      return h.invalidateArenaAthletes(...args)
    } },
    '@/modules/athletes/lib/athlete-cache-events': cacheEvents,
    '@/lib/supabase/browser': { createSupabaseBrowserClient: () => ({ auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    } }) },
  }, { window: target })
  const wrapper = DashboardQueryProvider({ children: 'private' })
  const rendered = wrapper.type(wrapper.props)
  const client = rendered.props.client
  const cleanups = effects.map(fn => fn())
  const channel = channels[0]
  const first = h.athletePageOptions(scope, query)
  const second = h.athletePageOptions(scope, { ...query, page: 2 })
  const foreign = h.athletePageOptions({ ...scope, arenaId: otherId }, query)
  for (const options of [first, second, foreign]) client.setQueryData(options.queryKey, page())
  const observer = new QueryObserver(client, first)
  const unsubscribe = observer.subscribe(() => {})
  t.after(() => {
    unsubscribe(); observer.destroy()
    for (const cleanup of cleanups) cleanup?.()
    client.clear()
  })
  assert.equal(h.calls.length, 0)

  target.dispatchEvent(new CustomEvent(cacheEvents.ATHLETES_CHANGED_EVENT, { detail: arenaId }))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(h.calls.length, 1)
  assert.equal(client.getQueryState(first.queryKey).isInvalidated, false)
  assert.equal(client.getQueryState(second.queryKey).isInvalidated, true)
  assert.equal(client.getQueryState(foreign.queryKey).isInvalidated, false)

  channel.onmessage({ data: { arenaId, source: cacheEvents.ATHLETES_CACHE_SOURCE } })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(h.calls.length, 1, 'the sender tab must not process its own broadcast a second time')

  channel.onmessage({ data: { arenaId, source: 'other-tab' } })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(h.calls.length, 2)
  assert.equal(client.getQueryState(foreign.queryKey).isInvalidated, false)

  channel.onmessage({ data: { arenaId: otherId, source: 'other-tab' } })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(h.calls.length, 2, 'an inactive foreign arena must not refetch the current arena')
  assert.equal(client.getQueryState(foreign.queryKey).isInvalidated, true)

  for (const data of [null, undefined, {}, { arenaId: 'invalid', source: 'other-tab' }]) channel.onmessage({ data })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(h.calls.length, 2)

  for (const cleanup of cleanups) cleanup?.()
  assert.equal(closed, true)
  const receivedBeforeUnmountEvent = receivedChanges
  target.dispatchEvent(new CustomEvent(cacheEvents.ATHLETES_CHANGED_EVENT, { detail: arenaId }))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(receivedChanges, receivedBeforeUnmountEvent, 'unmount must remove the local event listener')
  assert.equal(h.calls.length, 2, 'unmounted listeners must not issue new reads')
})

test('hook hides cached rows on a failed refresh and keeps the real error retryable', () => {
  const { useAthletePage } = loadTypescriptModule('src/modules/athletes/hooks/useAthletePage.ts', {
    react: { ...realReact, useState: initial => [initial, () => {}], useEffect() {}, useMemo: fn => fn(), useRef: initial => ({ current: initial }) },
    '@/contexts/UserContext': { useDbUser: () => ({ dbUser: { id: userId } }) },
    '@tanstack/react-query': {
      queryOptions,
      useQuery: () => ({ data: page(), isError: true, isPending: false, isFetching: false, error: new Error('Forbidden'), refetch() {} }),
      useQueryClient: () => ({}),
    },
  })
  const result = useAthletePage(arenaId, false, query)
  assert.equal(result.data, undefined)
  assert.equal(result.error, 'Forbidden')
  assert.equal(result.isLoading, false)
})


test('network errors remain localized and retryable; a non-JSON auth denial still purges cached pages', async t => {
  const offline = harness(t, async () => { throw new TypeError('Failed to fetch') })
  await assert.rejects(offline.client.fetchQuery(offline.athletePageOptions(scope, query)), /Não foi possível carregar os atletas/)
  const forbidden = harness(t, async () => ({ ok: false, status: 403, async json() { throw new SyntaxError('HTML error page') } }))
  const other = forbidden.athletePageOptions(scope, { ...query, page: 2 })
  forbidden.client.setQueryData(other.queryKey, page(2))
  await assert.rejects(forbidden.client.fetchQuery(forbidden.athletePageOptions(scope, query)), error => error.status === 403)
  assert.equal(forbidden.client.getQueryData(other.queryKey), undefined)
})


test('paused offline reads show a connection error instead of an endless loading state or cached rows', () => {
  for (const cached of [undefined, page()]) {
    const { useAthletePage: readPage } = loadTypescriptModule('src/modules/athletes/hooks/useAthletePage.ts', {
      react: { ...realReact, useState: initial => [initial, () => {}], useEffect() {}, useMemo: fn => fn(), useRef: initial => ({ current: initial }) },
      '@/contexts/UserContext': { useDbUser: () => ({ dbUser: { id: userId } }) },
      '@tanstack/react-query': { queryOptions,
        useQuery: () => ({ data: cached, isError: false, isPending: !cached, isPaused: true, isFetching: false, refetch() {} }),
        useQueryClient: () => ({}),
      },
    })
    const result = readPage(arenaId, false, query)
    assert.equal(result.data, undefined)
    assert.equal(result.isLoading, false)
    assert.match(result.error, /Sem conexão/)
  }
})

test('failed user bootstrap is retryable without fetching or displaying an unscoped athlete page', () => {
  let user = { dbUser: null, error: 'HTTP 500', retry() { userRetries++ } }
  let userRetries = 0, pageRetries = 0, observedOptions
  const { useAthletePage: readPage } = loadTypescriptModule('src/modules/athletes/hooks/useAthletePage.ts', {
    react: { ...realReact, useState: initial => [initial, () => {}], useEffect() {}, useMemo: fn => fn(), useRef: initial => ({ current: initial }) },
    '@/contexts/UserContext': { useDbUser: () => user },
    '@tanstack/react-query': { queryOptions,
      useQuery: options => {
        observedOptions = options
        return { data: page(), isPending: true, isError: false, isFetching: false,
          refetch() { pageRetries++ } }
      },
      useQueryClient: () => ({}),
    },
  })
  const failed = readPage(arenaId, false, query)
  assert.equal(observedOptions.enabled, false)
  assert.equal(failed.data, undefined)
  assert.equal(failed.isLoading, false)
  assert.match(failed.error, /Não foi possível carregar seu usuário/)
  failed.retry()
  assert.equal(userRetries, 1)
  assert.equal(pageRetries, 0)

  user = { ...user, error: null }
  const recovering = readPage(arenaId, false, query)
  assert.equal(recovering.isLoading, true)
  assert.equal(recovering.error, undefined)
  assert.equal(recovering.data, undefined)
  assert.equal(observedOptions.enabled, false)

  user = { ...user, dbUser: { id: userId } }
  const recovered = readPage(arenaId, false, query)
  assert.equal(recovered.error, undefined)
  assert.equal(observedOptions.enabled, true)
  assert.equal(observedOptions.queryKey[1], userId)
  recovered.retry()
  assert.equal(pageRetries, 1)
})

test('tutorial reads remain available when the real user bootstrap is unavailable', () => {
  let observedOptions
  const { useAthletePage: readPage } = loadTypescriptModule('src/modules/athletes/hooks/useAthletePage.ts', {
    react: { ...realReact, useState: initial => [initial, () => {}], useEffect() {}, useMemo: fn => fn(), useRef: initial => ({ current: initial }) },
    '@/contexts/UserContext': { useDbUser: () => ({ dbUser: null, error: 'HTTP 500', retry() {} }) },
    '@tanstack/react-query': { queryOptions,
      useQuery: options => {
        observedOptions = options
        return { data: page(), isPending: false, isError: false, isFetching: false, refetch() {} }
      },
      useQueryClient: () => ({}),
    },
  })
  const result = readPage(arenaId, true, query)
  assert.equal(observedOptions.enabled, true)
  assert.equal(result.isLoading, false)
  assert.equal(result.error, undefined)
  assert.equal(result.data.page, 1)
})


test('a list remount during mutation invalidation reuses the fresh read instead of cancelling and repeating it', async t => {
  let release
  const h = harness(t, () => new Promise(resolve => { release = resolve }))
  const options = h.athletePageOptions(scope, query)
  h.client.setQueryData(options.queryKey, page())
  const invalidation = h.invalidateArenaAthletes(h.client, arenaId)
  const observer = new QueryObserver(h.client, options)
  const unsubscribe = observer.subscribe(() => {})
  t.after(() => { unsubscribe(); observer.destroy() })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(h.calls.length, 1)
  release({ ok: true, status: 200, json: async () => ({ success: true, data: page() }) })
  await invalidation
})

// React runs passive cleanups before passive setups. useQuery applies a new
// observer key during setup, so render alone does not make a prefetch active.
function hookWithObserver(h) {
  const effects = [], refs = [], state = []
  let effectIndex, refIndex, stateIndex, pendingEffects, observer, unsubscribe
  const react = { ...realReact,
    useState(initial) {
      const i = stateIndex++
      if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial
      return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value }]
    },
    useRef(initial) { const i = refIndex++; return refs[i] ??= { current: initial } },
    useMemo: fn => fn(),
    useEffect(setup, deps) {
      const i = effectIndex++, previous = effects[i]
      if (!previous || deps.some((value, j) => !Object.is(value, previous.deps[j]))) pendingEffects.push({ i, setup, deps })
    },
  }
  const { useAthletePage: readPage } = loadTypescriptModule('src/modules/athletes/hooks/useAthletePage.ts', {
    react, '@/contexts/UserContext': { useDbUser: () => ({ dbUser: { id: userId } }) },
    '../lib/athlete-query-cache': h,
    '@tanstack/react-query': { useQueryClient: () => h.client,
      useQuery(options) {
        if (!observer) {
          observer = new QueryObserver(h.client, options)
          unsubscribe = observer.subscribe(() => {})
        }
        const result = observer.getOptimisticResult(h.client.defaultQueryOptions(options))
        react.useEffect(() => { observer.setOptions(options) }, [options])
        return result
      },
    },
  }, { navigator: {} })
  return {
    render(input) {
      effectIndex = refIndex = stateIndex = 0; pendingEffects = []
      return readPage(arenaId, false, input)
    },
    commit() {
      for (const { i } of pendingEffects) effects[i]?.cleanup?.()
      for (const { i, setup, deps } of pendingEffects) effects[i] = { deps, cleanup: setup() }
    },
    unmount() {
      unsubscribe?.(); observer?.destroy()
      for (const effect of effects) effect?.cleanup?.()
    },
  }
}

test('selecting the next page while its prefetch is pending keeps the same read through React effect cleanup/setup', async t => {
  const pending = []
  const h = harness(t, (_, options) => new Promise(resolve => pending.push({ resolve, options })))
  h.client.setQueryData(h.athletePageKey(scope, query), page())
  const hook = hookWithObserver(h)
  t.after(() => {
    hook.unmount()
    for (const { resolve } of pending) resolve({ ok: true, json: async () => ({ success: true, data: page(2) }) })
  })
  hook.render(query); hook.commit()
  assert.equal(h.calls.length, 1)
  assert.equal(JSON.parse(h.calls[0].options.body).page, 2)

  hook.render({ ...query, page: 2 })
  hook.commit()
  assert.equal(h.calls.length, 1, 'the visible page must reuse its pending prefetch')
  assert.equal(h.calls[0].options.signal.aborted, false)
  pending[0].resolve({ ok: true, json: async () => ({ success: true, data: page(2) }) })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(h.client.getQueryData(h.athletePageKey(scope, { ...query, page: 2 })).page, 2)
})

test('changing search and unmounting still abort unused prefetch and discard late responses', async t => {
  for (const transition of ['search', 'unmount']) {
    let release
    const h = harness(t, () => new Promise(resolve => { release = resolve }))
    h.client.setQueryData(h.athletePageKey(scope, query), page())
    const hook = hookWithObserver(h)
    t.after(() => hook.unmount())
    hook.render(query); hook.commit()
    assert.equal(h.calls.length, 1)
    if (transition === 'search') { hook.render({ ...query, search: 'nova busca' }); hook.commit() }
    else hook.unmount()
    assert.equal(h.calls[0].options.signal.aborted, true, transition)
    release({ ok: true, json: async () => ({ success: true, data: page(2) }) })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(h.client.getQueryData(h.athletePageKey(scope, { ...query, page: 2 })), undefined, transition)
  }
})
