import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule, realReact } from './helpers/load-typescript-module.mjs'

function collect(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(item => collect(item, predicate))
  if (!node || typeof node !== 'object') return []
  return [...(predicate(node) ? [node] : []), ...collect(node.props?.children, predicate)]
}
const text = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.props?.children) : ''

function harness(tiers = [{ minimumHoursBeforeStart: 0, refundPercentage: 100 }, { minimumHoursBeforeStart: 24, refundPercentage: 100 }]) {
  const states = [], requests = [], errors = []
  let cursor = 0
  const initialSettings = { currentPolicy: null, publishedVersions: [], draftPolicy: { id: 'draft', version: 1, tiers } }
  const { cancellationPolicyTiersSchema } = loadTypescriptModule('src/modules/arenas/schemas/cancellation-policy.schema.ts')
  const { ArenaCancellationPolicyCard } = loadTypescriptModule('src/modules/arenas/components/ArenaCancellationPolicyCard.tsx', {
    react: { ...realReact, useMemo: factory => factory(), useState(initial) {
      const index = cursor++
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
      return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next }]
    } },
    '@/modules/arenas/actions/cancellationPolicyActions': {
      saveArenaCancellationPolicyDraftAction: async (arenaId, policyId, submittedTiers) => {
        assert.equal(arenaId, 'arena')
        assert.equal(policyId, 'draft')
        assert.equal(cancellationPolicyTiersSchema.safeParse(submittedTiers).success, true)
        requests.push(JSON.parse(JSON.stringify(submittedTiers)))
        return { success: false, error: 'Fixture stops after observing the request' }
      },
    },
    sonner: { toast: { error: message => errors.push(message), success() {} } },
  })
  function render() {
    cursor = 0
    return ArenaCancellationPolicyCard({ arenaId: 'arena', initialSettings })
  }
  const field = prefix => collect(render(), node => node.props?.id?.startsWith?.(prefix))[0]
  const save = () => collect(render(), node => typeof node.props?.onClick === 'function' && text(node).includes('Salvar rascunho'))[0]
  return { requests, errors, field, save, change(prefix, value) { field(prefix).props.onChange({ target: { value } }) } }
}

test('clearing either cancellation field stays visible and blocks the real save handler', async () => {
  for (const prefix of ['refund-', 'hours-']) {
    const fixture = harness()
    fixture.change(prefix, '')
    assert.equal(fixture.field(prefix).props.value, '')
    assert.equal(fixture.save().props.disabled, true)
    // Exercise the handler guard too, independently of the disabled UI button.
    fixture.save().props.onClick()
    await Promise.resolve()
    assert.deepEqual(fixture.requests, [], prefix)
    assert.match(fixture.errors[0], /Preencha horas e percentuais inteiros válidos/)
  }
})

test('an untouched new draft cannot silently turn its missing refund into zero', async () => {
  const fixture = harness([])
  assert.equal(fixture.field('hours-').props.value, '0')
  assert.equal(fixture.field('refund-').props.value, '')
  assert.equal(fixture.save().props.disabled, true)
  fixture.save().props.onClick()
  await Promise.resolve()
  assert.deepEqual(fixture.requests, [])
})

test('explicit zero and valid whole decimal hours/refunds preserve their exact server values', async () => {
  for (const refund of ['0', '25', '100']) {
    const fixture = harness([{ minimumHoursBeforeStart: 0, refundPercentage: 50 }])
    fixture.change('hours-', '0')
    fixture.change('refund-', refund)
    assert.equal(fixture.save().props.disabled, false, refund)
    fixture.save().props.onClick()
    await Promise.resolve()
    assert.deepEqual(fixture.requests, [[{ minimumHoursBeforeStart: 0, refundPercentage: Number(refund) }]])
  }
  const fixture = harness()
  fixture.change('hours-', '2147483647')
  fixture.change('refund-', '75')
  assert.equal(fixture.save().props.disabled, false)
  fixture.save().props.onClick()
  await Promise.resolve()
  assert.deepEqual(fixture.requests[0], [{ minimumHoursBeforeStart: 0, refundPercentage: 100 }, { minimumHoursBeforeStart: 2147483647, refundPercentage: 75 }])
})

test('fractions, overflow, nondecimal text and nonstrings cannot be coerced into a policy', async () => {
  for (const prefix of ['refund-', 'hours-']) {
    const invalid = ['', ' ', '1.5', '1,5', '0x10', '1e2', '-1', 'NaN', 'Infinity', null, undefined, true, false, Number.NaN,
      prefix === 'hours-' ? '2147483648' : '101']
    for (const value of invalid) {
      const fixture = harness()
      fixture.change(prefix, value)
      assert.equal(fixture.save().props.disabled, true, `${prefix}/${String(value)}`)
      fixture.save().props.onClick()
      await Promise.resolve()
      assert.deepEqual(fixture.requests, [], `${prefix}/${String(value)}`)
    }
  }
})
