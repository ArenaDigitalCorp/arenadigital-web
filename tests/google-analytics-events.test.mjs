import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

function telemetry(gtag) {
  const logs = []
  const client = loadTypescriptModule('src/lib/telemetry/client.ts', {
    '@pydantic/logfire-browser': {
      info: (...args) => logs.push(args),
      error() {},
      reportError() {},
    },
  }, {
    window: { gtag, location: { pathname: '/dashboard', search: '?tutorial=1' } },
  })
  return { client, logs }
}

test('web screen views remain in Logfire without duplicating GA4 page views', () => {
  const events = []
  const { client, logs } = telemetry((...args) => events.push(args))
  client.trackScreenView('/dashboard')
  client.trackScreenView('/dashboard/arenas')
  assert.equal(events.length, 0)
  assert.equal(logs.length, 2)
  assert.equal(logs[0][0], 'telemetry.screen_view')
  assert.equal(logs[1][1].page_path, '/dashboard/arenas')
})

test('business analytics keeps the existing parameter allowlist', () => {
  const events = []
  const { client } = telemetry((...args) => events.push(args))
  client.trackAction('finance_transaction', 'success', {
    arena_id: 'synthetic-arena-id',
    email: 'synthetic@example.invalid',
    cpf: 'synthetic-private-document',
    amount: 100,
  })
  assert.equal(events[0][1], 'finance_transaction_success')
  assert.equal(events[0][2].arena_id, 'synthetic-arena-id')
  assert.equal(Object.hasOwn(events[0][2], 'email'), false)
  assert.equal(Object.hasOwn(events[0][2], 'cpf'), false)
  assert.equal(Object.hasOwn(events[0][2], 'amount'), false)
})

test('an analytics provider failure cannot turn a successful operation into an error', () => {
  const { client, logs } = telemetry(() => { throw new Error('Synthetic analytics failure') })
  assert.doesNotThrow(() => client.trackAction('finance_transaction', 'success'))
  assert.equal(logs[0][0], 'telemetry.finance_transaction_success')
})
