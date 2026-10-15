import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

function hooks() {
  const slots = []
  let cursor = 0
  return {
    reset() { cursor = 0 },
    react: {
      useState(initial) {
        const index = cursor++
        if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
        return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next }]
      },
      useMemo: fn => fn(),
    },
  }
}

function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return null
  if (predicate(tree)) return tree
  for (const child of [tree.props?.children].flat(Infinity)) {
    const found = find(child, predicate)
    if (found) return found
  }
  return null
}

test('commission inputs keep reais/basis points units and reject malformed/empty values before persistence', () => {
  const state = hooks()
  const { ArenaCommissionFields } = loadTypescriptModule('src/modules/arenas/components/ArenaCommissionFields.tsx', { react: state.react })
  const { updateArenaPixSplitSettingsSchema } = loadTypescriptModule('src/modules/arenas/schemas/asaas-baas.schema.ts')
  let value = { commissionMode: 'fixed', commissionFixedCents: 200, platformFeeBasisPoints: 0 }
  const render = () => { state.reset(); return ArenaCommissionFields({ value, onChange: next => { value = next } }) }
  const input = () => find(render(), element => element.props?.id === 'platform-split-fee')
  input().props.onChange({ target: { value: '1.234,56' } })
  assert.equal(value.commissionFixedCents, 123456)
  assert.equal(input().props.value, '1.234,56')
  for (const invalid of ['', '12oops', '1.234']) {
    input().props.onChange({ target: { value: invalid } })
    assert.equal(input().props.value, invalid)
    assert.equal(input().props['aria-invalid'], true)
    assert.equal(updateArenaPixSplitSettingsSchema.safeParse({ ...value, enabled: false }).success, false)
  }
  value = { commissionMode: 'percentage_net', commissionFixedCents: 0, platformFeeBasisPoints: 200 }
  input().props.onChange({ target: { value: '2,50' } })
  assert.equal(value.platformFeeBasisPoints, 250)
  input().props.onChange({ target: { value: '100,01' } })
  assert.equal(updateArenaPixSplitSettingsSchema.safeParse({ ...value, enabled: false }).success, false)
})

test('one-off booking price keeps its typed draft and invalid input cannot become a zero price', () => {
  const state = hooks()
  const { AvulsoBlocosPicker } = loadTypescriptModule('src/modules/bookings/components/AvulsoBlocosPicker.tsx', { react: state.react })
  let amount = 100
  const render = () => {
    state.reset()
    return AvulsoBlocosPicker({ courts: [{ id: 'court', name: 'Espaço', day_config: [] }], bookings: [], isLoading: false,
      selected: new Set(), onToggleSlot() {}, onRemoveBloco() {}, weekStart: new Date(2030, 0, 7), onNavigateWeek() {},
      activeCourtId: 'court', onActiveCourtChange() {},
      blocos: [{ courtId: 'court', date: '2030-01-07', from: 9, to: 10, hours: [9], valor: amount, valorSugerido: 100 }],
      onBlocoValorChange(_key, next) { amount = next }, isQuoting: false })
  }
  const input = () => find(render(), element => element.props?.['aria-label'] === 'Valor do horário')
  input().props.onChange({ target: { value: '1.234,56' } })
  assert.equal(amount, 1234.56)
  assert.equal(input().props.value, '1.234,56')
  for (const invalid of ['', '12oops', '-1', '1.234']) {
    input().props.onChange({ target: { value: invalid } })
    assert.equal(Number.isNaN(amount), true)
    assert.equal(input().props.value, invalid)
    assert.equal(input().props['aria-invalid'], true)
  }
  input().props.onChange({ target: { value: '0,00' } })
  assert.equal(amount, 0)
  assert.equal(input().props['aria-invalid'], false)
})
