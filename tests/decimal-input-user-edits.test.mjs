import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

function harness() {
  let presentation = null
  const { DecimalInput } = loadTypescriptModule('src/components/ui/decimal-input.tsx', {
    react: { useState: () => [presentation, next => { presentation = next }] },
  })
  return props => DecimalInput(props)
}

test('focusing and blurring an automatic price does not turn it into a manual price', () => {
  const render = harness()
  let amount = '1000.00', edited = false, changeCalls = 0
  const onChange = event => { amount = event.target.value; edited = true; changeCalls++ }
  let element = render({ value: amount, onChange })
  const target = { value: amount }
  element.props.onBlur({ currentTarget: target, target })
  element = render({ value: amount, onChange })
  assert.equal(element.props.value, '1.000,00')
  assert.equal(amount, '1000.00')
  assert.equal(edited, false)
  assert.equal(changeCalls, 0)
  // The same guard used by booking automatic pricing still accepts the next price.
  if (amount === '1000.00') amount = '1800.00'
  element = render({ value: amount, onChange })
  assert.equal(element.props.value, '1800.00')
  target.value = amount
  element.props.onBlur({ currentTarget: target, target })
  assert.equal(render({ value: amount, onChange }).props.value, '1.800,00')
  assert.equal(changeCalls, 0)
})

test('actual editing emits once and blur changes only presentation', () => {
  const render = harness()
  let amount = '1000.00', changeCalls = 0
  const onChange = event => { amount = event.target.value; changeCalls++ }
  let element = render({ value: amount, onChange })
  const target = { value: '1234.56' }
  element.props.onChange({ currentTarget: target, target })
  element = render({ value: amount, onChange })
  element.props.onBlur({ currentTarget: target, target })
  assert.equal(render({ value: amount, onChange }).props.value, '1.234,56')
  assert.equal(amount, '1234.56')
  assert.equal(changeCalls, 1)
  // Invalid input remains visible and is never silently rewritten.
  target.value = '12oops'
  render({ value: amount, onChange }).props.onChange({ currentTarget: target, target })
  render({ value: amount, onChange }).props.onBlur({ currentTarget: target, target })
  assert.equal(render({ value: amount, onChange }).props.value, '12oops')
  assert.equal(changeCalls, 2)
})
