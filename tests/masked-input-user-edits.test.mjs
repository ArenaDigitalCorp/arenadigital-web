import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

const doc = loadTypescriptModule('src/lib/brasil-document.ts')

function harness(mask, initial = '') {
  const refs = [], states = []
  let refIndex = 0, stateIndex = 0, value = initial, input
  const changes = [], callbacks = []
  const document = { activeElement: null }
  const { MaskedInput } = loadTypescriptModule('src/components/ui/masked-input.tsx', {
    react: {
      useRef: initial => refs[refIndex++] ??= { current: initial },
      useState(initial) {
        const index = stateIndex++
        if (!(index in states)) states[index] = initial
        return [states[index], next => { states[index] = next }]
      },
    },
  }, { document, requestAnimationFrame: callback => callbacks.push(callback) })
  function render(extra = {}) {
    refIndex = stateIndex = 0
    return MaskedInput({ mask, value, onChange: event => { value = event.target.value; changes.push(value) }, ...extra })
  }
  input = { value: initial, selectionStart: initial.length, selectionEnd: initial.length, isConnected: true,
    setSelectionRange(start, end) { input.selectionStart = start; input.selectionEnd = end } }
  document.activeElement = input
  const event = () => ({ target: input, currentTarget: input, preventDefault() {}, stopPropagation() {}, isDefaultPrevented: () => false, isPropagationStopped: () => false, persist() {} })
  return { input, changes, render, event, get value() { return value }, flushSelection() { while (callbacks.length) callbacks.shift()() } }
}

test('phone paste keeps an explicit Brazil country code even when spaced and incomplete', () => {
  for (const raw of ['+ 55 999999999', '+(55)999999999', '+ 5 5 999999999', '+ 55']) {
    const h = harness('phone')
    h.input.value = raw; h.input.selectionStart = raw.length
    h.render().props.onChange(h.event())
    assert.equal(doc.normalizePhone(raw), null)
    assert.equal(doc.normalizePhone(h.value), null, raw)
    assert.match(h.value, /^\+55/u)
  }
  const h = harness('phone')
  h.input.value = '+ (55) 48 99642-6091'; h.input.selectionStart = h.input.value.length
  h.render().props.onChange(h.event())
  assert.equal(doc.normalizePhone(h.value), '+5548996426091')
})

test('deleting user punctuation from a malformed CPF never consumes its forbidden letter', () => {
  for (const key of ['Delete', 'Backspace']) for (const letter of ['A', 'é', 'ß', 'ı', 'Ａ']) {
    const h = harness('cpf', `529.${letter}98224725`)
    h.input.selectionStart = h.input.selectionEnd = key === 'Delete' ? 3 : 4
    const element = h.render()
    element.props.onKeyDown({ ...h.event(), key })
    h.input.value = `529${letter}98224725`; h.input.selectionStart = h.input.selectionEnd = 3
    element.props.onChange(h.event()); h.flushSelection()
    assert.equal(h.value, `529${letter}98224725`)
    assert.equal(doc.isValidCpf(h.value), false)
    assert.equal(h.input.selectionStart, 3)
  }
})

test('canonical mask separator deletion and selected replacements keep their numeric editing behavior', () => {
  const h = harness('cpf', '123.456')
  h.input.selectionStart = h.input.selectionEnd = 4
  const element = h.render()
  element.props.onKeyDown({ ...h.event(), key: 'Backspace' })
  h.input.value = '123456'; h.input.selectionStart = h.input.selectionEnd = 3
  element.props.onChange(h.event()); h.flushSelection()
  assert.equal(h.value, '124.56')
  assert.equal(h.input.selectionStart, 2)
  const replacement = harness('cpf', '123.456.789-01')
  replacement.input.selectionStart = 4; replacement.input.selectionEnd = 7
  const selected = replacement.render()
  selected.props.onKeyDown({ ...replacement.event(), key: '9' })
  replacement.input.value = '123.999.789-01'; replacement.input.selectionStart = replacement.input.selectionEnd = 7
  selected.props.onChange(replacement.event()); replacement.flushSelection()
  assert.equal(replacement.value, '123.999.789-01')
  assert.equal(replacement.input.selectionStart, 7)
})

test('controlled IME text remains raw through rerenders and commits formatting only at composition end', () => {
  const h = harness('cpf')
  h.render().props.onCompositionStart(h.event())
  h.input.value = '1234'; h.input.selectionStart = 4
  h.render().props.onChange(h.event())
  assert.equal(h.value, '1234')
  assert.equal(h.render().props.value, '1234')
  h.render().props.onCompositionEnd(h.event()); h.flushSelection()
  assert.equal(h.value, '123.4')
  assert.equal(h.render().props.value, '123.4')
  assert.equal(h.input.selectionStart, 5)
})

test('IME final text is delivered even when the browser has not sent a final input event', () => {
  const h = harness('cnpj')
  h.render().props.onCompositionStart(h.event())
  h.input.value = 'e'; h.input.selectionStart = 1
  h.render().props.onChange(h.event())
  assert.equal(h.render().props.value, 'e')
  h.input.value = 'é'; h.input.selectionStart = 1
  h.render().props.onCompositionEnd(h.event())
  assert.equal(h.value, 'é')
  assert.equal(h.render().props.value, 'é')
  assert.equal(doc.isValidCnpj(h.value), false)
})

test('uncontrolled IME input keeps its DOM draft and commits a formatted final value', () => {
  const h = harness('cpf')
  const uncontrolled = { value: undefined, defaultValue: '1234' }
  h.render(uncontrolled).props.onCompositionStart(h.event())
  h.input.value = '5678'; h.input.selectionStart = 4
  h.render(uncontrolled).props.onChange(h.event())
  assert.equal(h.input.value, '5678')
  assert.equal(h.render(uncontrolled).props.value, undefined)
  h.render(uncontrolled).props.onCompositionEnd(h.event()); h.flushSelection()
  assert.equal(h.value, '567.8')
  assert.equal(h.input.value, '567.8')
})
