import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

function component(phase) {
  return loadTypescriptModule('src/modules/loyalty/components/LoyaltyLocalDate.tsx', {
    react: { ...React, useSyncExternalStore(_subscribe, snapshot, serverSnapshot) {
      return phase === 'browser' ? snapshot() : serverSnapshot()
    } },
  }).LoyaltyLocalDate
}
const render = (Component, value, time = false) => renderToStaticMarkup(React.createElement(Component, { value, time }))

test('UTC server and first Sao Paulo hydration render exactly the same date/time placeholders', () => {
  const tz = process.env.TZ
  try {
    for (const value of ['2026-10-17T01:30:00Z', '2026-10-31T23:59:59.999Z', '2026-11-01T00:00:00Z', '2026-11-01']) {
      for (const time of [false, true]) {
        process.env.TZ = 'UTC'; const server = render(component('server'), value, time)
        process.env.TZ = 'America/Sao_Paulo'; const hydration = render(component('hydration'), value, time)
        assert.equal(server, hydration); assert.match(server, /—<\/time>/)
      }
    }
  } finally { if (tz === undefined) delete process.env.TZ; else process.env.TZ = tz }
})

test('after hydration the original browser-local instant semantics and minute precision remain intact', () => {
  const tz = process.env.TZ
  try {
    const DateCell = component('browser')
    process.env.TZ = 'America/Sao_Paulo'
    assert.match(render(DateCell, '2026-10-17T01:30:00Z'), />16\/10\/2026</)
    assert.match(render(DateCell, '2026-10-17T01:30:45Z', true), />22:30</)
    assert.match(render(DateCell, '2026-11-01T02:59:59Z'), />31\/10\/2026</)
    assert.match(render(DateCell, '2026-11-01T03:00:00Z'), />01\/11\/2026</)
    process.env.TZ = 'UTC'
    assert.match(render(DateCell, '2026-10-17T01:30:00Z'), />17\/10\/2026</)
    assert.match(render(DateCell, '2026-10-17T01:30:00Z', true), />01:30</)
  } finally { if (tz === undefined) delete process.env.TZ; else process.env.TZ = tz }
})

test('real server rendering does not depend on the machine timezone', () => {
  const { LoyaltyLocalDate } = loadTypescriptModule('src/modules/loyalty/components/LoyaltyLocalDate.tsx')
  assert.equal(render(LoyaltyLocalDate, '2026-10-17T01:30:00Z'), '<time dateTime="2026-10-17T01:30:00Z">—</time>')
})
