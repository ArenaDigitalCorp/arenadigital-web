import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule, realReact } from './helpers/load-typescript-module.mjs'

function collect(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(item => collect(item, predicate))
  if (!node || typeof node !== 'object') return []
  return [...(predicate(node) ? [node] : []), ...collect(node.props?.children, predicate)]
}

function harness({ now = '2026-10-15T12:34:56.789Z', startsAt = now, endsAt = null } = {}) {
  let clock = now, cursor = 0, saved, authCalls = 0
  const states = [], tasks = [], requests = [], errors = []
  class FixtureDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])) }
    static now() { return new Date(clock).getTime() }
  }
  const item = { id: '10000000-0000-4000-8000-000000000001', kind: 'announcement', title: 'Fixture content',
    description: null, image_url: null, cta_label: null, cta_url: null, cta_kind: 'none', city_id: null,
    sport_id: null, priority: 0, starts_at: startsAt, ends_at: endsAt, active: true, created_at: now }
  const query = { eq: () => query, select: () => query, single: async () => ({ data: saved, error: null }) }
  const db = { from(name) {
    assert.equal(name, 'app_home_content')
    const write = (mode, payload) => { requests.push({ mode, payload }); saved = { ...item, ...payload }; return query }
    return { insert: payload => write('insert', payload), update: payload => write('update', payload) }
  } }
  const { upsertAppHomeContentAction } = loadTypescriptModule('src/modules/mobile-content/actions/mobileContentActions.ts', {
    'next/cache': { revalidatePath() {} },
    '@/lib/server-auth': { assertPlatformAdminAccess: async () => { authCalls++; return { dbUserId: 'admin' } } },
    '@/lib/supabase-server': { getSupabaseAdmin: () => db },
  }, { Date: FixtureDate })
  const { AppHomeContentAdminClient } = loadTypescriptModule('src/modules/mobile-content/components/AppHomeContentAdminClient.tsx', {
    react: { ...realReact, useMemo: factory => factory(), useTransition: () => [false, callback => { tasks.push(callback()) }],
      useState(initial) {
        const index = cursor++
        if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
        return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next }]
      } },
    '@/modules/mobile-content/actions/mobileContentActions': {
      upsertAppHomeContentAction,
      listAppHomeContentAction: async () => ({ success: true, data: [saved ?? item] }),
    },
    sonner: { toast: { error: message => errors.push(message), success() {} } },
  }, { Date: FixtureDate })
  const render = () => { cursor = 0; return AppHomeContentAdminClient({ initialItems: [item], sports: [], cities: [] }) }
  const inputs = () => collect(render(), node => node.props?.type === 'datetime-local')
  return { item, requests, errors, get authCalls() { return authCalls },
    setNow(value) { clock = value },
    input(index) { return inputs()[index] },
    edit() { collect(render(), node => node.props?.['aria-label'] === 'Editar')[0].props.onClick() },
    newDraft() { collect(render(), node => node.props?.children === 'Novo' && typeof node.props?.onClick === 'function')[0].props.onClick() },
    change(index, value) { inputs()[index].props.onChange({ target: { value } }) },
    async save() {
      collect(render(), node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} })
      await Promise.all(tasks.splice(0))
    },
    setTitle(value) { collect(render(), node => node.props?.label === 'Título')[0].props.children.props.onChange({ target: { value } }) },
  }
}

async function inTimezone(timezone, callback) {
  const previous = process.env.TZ
  process.env.TZ = timezone
  try { await callback() }
  finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous }
}

test('new content defaults use one local-minute snapshot through spring, repeated fall hour and Brazil', async () => {
  for (const [timezone, now, visible, saved] of [
    ['America/New_York', '2026-03-08T07:30:56.789Z', '2026-03-08T03:30', '2026-03-08T07:30:00.000Z'],
    ['America/New_York', '2026-11-01T06:30:56.789Z', '2026-11-01T01:30', '2026-11-01T06:30:00.000Z'],
    ['America/Sao_Paulo', '2026-10-15T00:30:56.789Z', '2026-10-14T21:30', '2026-10-15T00:30:00.000Z'],
  ]) await inTimezone(timezone, async () => {
    const fixture = harness({ now })
    assert.equal(fixture.input(0).props.value, visible)
    fixture.setTitle('New fixture content')
    fixture.setNow('2026-12-01T12:00:00Z')
    await fixture.save()
    assert.equal(fixture.requests[0].mode, 'insert')
    assert.equal(fixture.requests[0].payload.starts_at, saved)
    assert.equal(fixture.requests[0].payload.ends_at, null)
    assert.equal(fixture.authCalls, 1)
    assert.deepEqual(fixture.errors, [])
  })
})

test('editing content preserves original Z/offset timestamps, fractional precision and nullable end dates', async () => {
  for (const [timezone, startsAt, endsAt, visibleStart, visibleEnd] of [
    ['America/New_York', '2026-03-08T07:30:45.123456Z', '2026-03-08T08:45:12.654321Z', '2026-03-08T03:30', '2026-03-08T04:45'],
    ['America/New_York', '2026-11-01T06:30:45.123456+00:00', '2026-11-01T02:45:12.654321-05:00', '2026-11-01T01:30', '2026-11-01T02:45'],
    ['America/Sao_Paulo', '2026-10-15T19:34:56.789123-03:00', null, '2026-10-15T19:34', ''],
  ]) await inTimezone(timezone, async () => {
    const fixture = harness({ startsAt, endsAt })
    fixture.edit()
    assert.equal(fixture.input(0).props.value, visibleStart)
    assert.equal(fixture.input(1).props.value, visibleEnd)
    fixture.setTitle('Only the title changed')
    await fixture.save()
    assert.equal(fixture.requests[0].mode, 'update')
    assert.equal(fixture.requests[0].payload.starts_at, startsAt)
    assert.equal(fixture.requests[0].payload.ends_at, endsAt)
    assert.deepEqual(fixture.errors, [])
  })
})

test('actually edited local date/times convert once and clearing the optional end stays null', async () => {
  for (const [timezone, entered, expected] of [
    ['America/New_York', '2026-03-08T04:15', '2026-03-08T08:15:00.000Z'],
    ['America/New_York', '2026-11-01T02:15', '2026-11-01T07:15:00.000Z'],
    ['America/Sao_Paulo', '2026-10-16T10:20', '2026-10-16T13:20:00.000Z'],
  ]) await inTimezone(timezone, async () => {
    const fixture = harness({ endsAt: '2026-12-01T12:00:00.123456Z' })
    fixture.edit()
    fixture.change(0, entered)
    fixture.change(1, '')
    await fixture.save()
    assert.equal(fixture.requests[0].payload.starts_at, expected)
    assert.equal(fixture.requests[0].payload.ends_at, null)
  })
  await inTimezone('America/Sao_Paulo', async () => {
    const fixture = harness()
    fixture.edit()
    fixture.change(1, '2026-10-16T18:20')
    await fixture.save()
    assert.equal(fixture.requests[0].payload.ends_at, '2026-10-16T21:20:00.000Z')
  })
})

test('nonexistent DST times and invalid civil dates show an error before any action or write', async () => {
  await inTimezone('America/New_York', async () => {
    for (const index of [0, 1]) for (const invalid of ['2026-03-08T02:30', '2026-02-30T10:20', 'not-a-date']) {
      const fixture = harness()
      fixture.edit()
      fixture.change(index, invalid)
      await fixture.save()
      assert.deepEqual(fixture.requests, [])
      assert.equal(fixture.authCalls, 0)
      assert.match(fixture.errors[0], /data e horário válidos/)
    }
  })
})

test('resetting an edited item takes a fresh default snapshot including the second repeated hour', async () => {
  await inTimezone('America/New_York', async () => {
    const fixture = harness()
    fixture.edit()
    fixture.setNow('2026-11-01T06:30:56.789Z')
    fixture.newDraft()
    assert.equal(fixture.input(0).props.value, '2026-11-01T01:30')
    fixture.setTitle('Fresh content')
    await fixture.save()
    assert.equal(fixture.requests[0].mode, 'insert')
    assert.equal(fixture.requests[0].payload.starts_at, '2026-11-01T06:30:00.000Z')
  })
})
