import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule, realReact } from './helpers/load-typescript-module.mjs'

function nodes(node, predicate) {
  const found = []
  function visit(value) {
    if (Array.isArray(value)) return value.forEach(visit)
    if (!value || typeof value !== 'object') return
    if (predicate(value)) found.push(value)
    visit(value.props?.children)
  }
  visit(node)
  return found
}

const base = {
  type: 'entrada', category: 'Outros', description: 'Lançamento de teste', quantity: '2',
  unit_value: '1.234,56', discount: '34,56', total_value: 0,
  launch_date: '2026-10-15', registration_date: '2026-10-15',
  modo_pagamento_id: 'd2000000-0000-4000-8000-000000000001',
}

function transactionHarness(values, editing = false, globals = {}) {
  const requests = [], errors = [], totals = []
  let submit, resolver, defaults, effectIndex = 0
  const { TransactionForm } = loadTypescriptModule('src/modules/finance/components/TransactionForm.tsx', {
    react: { ...realReact, useState: initial => [initial, () => {}],
      useEffect: effect => { if (effectIndex++ === 0) effect() } },
    'react-hook-form': { useForm: options => {
      resolver = options.resolver
      defaults = options.defaultValues
      return { control: {}, watch: key => values[key], setValue: (key, value) => { if (key === 'total_value') totals.push(value) },
        setError: (key, error) => errors.push({ key, ...error }), formState: { isSubmitting: false },
        handleSubmit: handler => { submit = handler; return handler } }
    } },
    '@/modules/finance/actions/financeActions': {
      createTransactionAction: async (_arena, input) => { requests.push(input); return { success: true } },
      updateTransactionAction: async (_arena, _id, input) => { requests.push(input); return { success: true } },
    },
    '@/modules/finance/actions/transactionCategoryActions': {},
    '@/modules/athletes/actions/athleteActions': {},
    '@/lib/telemetry/client': { trackAction() {} },
    sonner: { toast: { error() {}, success() {} } },
  }, globals)
  const tree = TransactionForm({ arenaId: 'arena', registeredBy: 'user', onSuccess() {}, onCancel() {},
    transaction: editing ? { ...values, id: 'transaction', quantity: 2, unit_value: 1234.56, discount: 34.56 } : undefined })
  return { submit, resolver, defaults, requests, errors, totals, tree }
}

test('new transaction dates follow the local civil day while editing keeps existing date-only values', () => {
  const previousTimezone = process.env.TZ
  try {
    for (const [timezone, instant, expectedDate] of [
      ['America/Sao_Paulo', '2026-10-15T00:30:00Z', '2026-10-14'],
      ['Pacific/Kiritimati', '2026-10-14T12:30:00Z', '2026-10-15'],
    ]) {
      process.env.TZ = timezone
      class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [instant])) } }
      const created = transactionHarness(base, false, { Date: FixedDate })
      assert.equal(created.defaults.launch_date, expectedDate, timezone)
      assert.equal(created.defaults.registration_date, expectedDate, timezone)
      for (const [launch, registration] of [
        ['2026-10-01', '2026-10-02'],
        ['2026-10-01T00:00:00.000Z', '2026-10-02T00:00:00.000Z'],
      ]) {
        const edited = transactionHarness({ ...base, launch_date: launch, registration_date: registration }, true, { Date: FixedDate })
        assert.equal(edited.defaults.launch_date, '2026-10-01')
        assert.equal(edited.defaults.registration_date, '2026-10-02')
      }
    }
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ
    else process.env.TZ = previousTimezone
  }
})

test('transaction actual create and update handlers send complete BRL values and recalculated totals', async () => {
  for (const editing of [false, true]) {
    const harness = transactionHarness(base, editing)
    await harness.submit(base)
    assert.equal(harness.requests.length, 1)
    assert.equal(harness.requests[0].quantity, 2)
    assert.equal(harness.requests[0].unit_value, 1234.56)
    assert.equal(harness.requests[0].discount, 34.56)
    assert.equal(harness.requests[0].total_value, 2434.56)
    assert.deepEqual(harness.totals, [2434.56])
    const resolved = await harness.resolver({ ...base, total_value: 2434.56 }, {}, { fields: {}, shouldUseNativeValidation: false })
    assert.equal(resolved.values.unit_value, 1234.56)
    assert.equal(Object.keys(resolved.errors).length, 0)
  }
})

test('transaction optional discount can be empty without making required prices or quantities optional', async () => {
  const valid = transactionHarness({ ...base, unit_value: '0,10', quantity: '3', discount: '' })
  await valid.submit({ ...base, unit_value: '0,10', quantity: '3', discount: '' })
  assert.equal(valid.requests[0].discount, 0)
  assert.equal(valid.requests[0].total_value, 0.3)
  for (const patch of [{ unit_value: '' }, { unit_value: '12abc' }, { unit_value: '1.234' }, { discount: '1.2.3,45' }, { discount: '-1,00' }, { quantity: '1.5' }, { quantity: '12abc' }]) {
    const values = { ...base, ...patch }
    const harness = transactionHarness(values)
    await harness.submit(values)
    assert.equal(harness.requests.length, 0, JSON.stringify(patch))
    assert.ok(harness.errors.length, JSON.stringify(patch))
    assert.ok(harness.totals.every(Number.isFinite))
    const resolved = await harness.resolver(values, {}, { fields: {}, shouldUseNativeValidation: false })
    assert.ok(Object.keys(resolved.errors).length)
  }
})

function caixaHarness(balance) {
  let index = 0
  const requests = [], errors = []
  const { CaixaPageClient } = loadTypescriptModule('src/modules/finance/components/CaixaPageClient.tsx', {
    react: { ...realReact, useState: initial => {
      const current = index++
      return [current === 0 ? false : current === 11 ? balance : initial, () => {}]
    }, useEffect() {}, useMemo: fn => fn(), useCallback: fn => fn },
    '@/modules/finance/actions/caixaSessionActions': {
      openCaixaSessionAction: async (_arena, input) => { requests.push(input); return { success: true } },
      getCurrentCaixaSessionAction: async () => ({ success: true, data: null }),
    },
    '@/modules/finance/actions/financeActions': {},
    '@/modules/finance/components/TransactionForm': { TransactionForm() {} },
    sonner: { toast: { error: message => errors.push(message), success() {} } },
  })
  const tree = CaixaPageClient({ arenaId: 'arena' })
  const open = nodes(tree, node => node.props?.children === 'Abrir caixa' && typeof node.props?.onClick === 'function')[0]
  assert.ok(open)
  return { open: open.props.onClick, requests, errors }
}

test('cash opening actual handler parses BRL and keeps required zero distinct from empty or malformed input', async () => {
  for (const [input, expected] of [['1.234,56',1234.56],['1234.56',1234.56],['0,00',0],['',null],['12abc',null],['1.234',null],['1.2.3,45',null],['-0,01',null],['100.000.000,00',null]]) {
    const harness = caixaHarness(input)
    await harness.open()
    if (expected === null) {
      assert.equal(harness.requests.length, 0, input)
      assert.equal(harness.errors.length, 1, input)
    } else {
      assert.equal(harness.requests[0].opening_balance, expected, input)
      assert.equal(harness.errors.length, 0, input)
    }
  }
})
