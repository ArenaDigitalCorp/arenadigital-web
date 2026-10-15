import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule, realReact } from './helpers/load-typescript-module.mjs'

function collect(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(item => collect(item, predicate))
  if (!node || typeof node !== 'object') return []
  return [...(predicate(node) ? [node] : []), ...collect(node.props?.children, predicate)]
}

function harness(now) {
  class FixtureDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])) }
    static now() { return new Date(now).getTime() }
  }
  const states = [], requests = []
  let cursor = 0, pending
  const { openGameActionSchema } = loadTypescriptModule('src/modules/mobile-content/schemas/mobile-content-action.schema.ts')
  const { MobileContentPageClient } = loadTypescriptModule('src/modules/mobile-content/components/MobileContentPageClient.tsx', {
    react: { ...realReact, useState(initial) {
      const index = cursor++
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
      return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next }]
    }, useTransition: () => [false, callback => { pending = callback() }] },
    '@/modules/mobile-content/actions/mobileContentActions': {
      upsertOpenGameAction: async (_arenaId, input) => {
        assert.equal(openGameActionSchema.safeParse(input).success, true)
        requests.push(input)
        return { success: false, error: 'Fixture stops after observing the request' }
      },
    },
    sonner: { toast: { error() {}, success() {} } },
  }, { Date: FixtureDate })
  const id = '10000000-0000-4000-8000-000000000001'
  const props = { arenaId: 'arena', arenaName: 'Fixture', courts: [], sports: [{ id, name: 'Esporte' }],
    athletes: [{ id, name: 'Responsável' }], initialPromotions: [], initialHighlights: [], initialOpenGames: [] }
  const render = () => { cursor = 0; return MobileContentPageClient(props) }
  collect(render(), node => node.type?.name === 'DashboardTabs')[0].props.onChange('open-games')
  for (const label of ['Esporte', 'Atleta responsável']) {
    collect(render(), node => node.props?.label === label)[0].props.children.props.onChange(id)
  }
  return {
    requests,
    dateInput: () => collect(render(), node => node.props?.type === 'date')[0],
    async submit() {
      collect(render(), node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} })
      await pending
    },
  }
}

const cases = [
  ['America/Sao_Paulo', '2026-10-15T00:30:00Z', '2026-10-14'],
  ['UTC', '2026-10-15T00:30:00Z', '2026-10-15'],
  ['Pacific/Kiritimati', '2026-10-15T12:30:00Z', '2026-10-16'],
]

test('new open game defaults and submits the local civil day in Brazil, UTC and UTC+14', async () => {
  const previousTimezone = process.env.TZ
  try {
    for (const [timezone, now, expectedDate] of cases) {
      process.env.TZ = timezone
      const fixture = harness(now)
      assert.equal(fixture.dateInput().props.value, expectedDate, timezone)
      await fixture.submit()
      assert.equal(fixture.requests.length, 1)
      assert.equal(fixture.requests[0].date, expectedDate, timezone)
    }
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ
    else process.env.TZ = previousTimezone
  }
})

test('an explicitly selected civil date is never shifted by the local timezone', async () => {
  const previousTimezone = process.env.TZ
  try {
    for (const [timezone, now] of cases) {
      process.env.TZ = timezone
      const fixture = harness(now)
      fixture.dateInput().props.onChange({ target: { value: '2026-11-01' } })
      assert.equal(fixture.dateInput().props.value, '2026-11-01')
      await fixture.submit()
      assert.equal(fixture.requests[0].date, '2026-11-01', timezone)
    }
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ
    else process.env.TZ = previousTimezone
  }
})
