import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule, realReact } from './helpers/load-typescript-module.mjs'

function collect(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(item => collect(item, predicate))
  if (!node || typeof node !== 'object') return []
  return [...(predicate(node) ? [node] : []), ...collect(node.props?.children, predicate)]
}
const mockReact = { ...realReact, useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
  useCallback: fn => fn, useMemo: fn => fn(), useEffect() {} }
const config = { day: 'Segunda-feira', enabled: true, startTime: '08:00', endTime: '10:00', price: 100, customPrices: [] }

test('hourly price field keeps invalid drafts visible without committing zero or a partial value', () => {
  let committed
  let draft
  const { DaySchedulePanel } = loadTypescriptModule('src/modules/courts/components/DaySchedulePanel.tsx', { react: mockReact })
  const props = { config, onChange: value => { committed = value }, priceDrafts: {}, onPriceDraftChange: value => { draft = value } }
  const tree = DaySchedulePanel(props)
  const input = collect(tree, node => node.props?.['aria-label'] === 'Valor por hora da faixa 1')[0]
  assert.ok(input)
  input.props.onChange({ target: { value: '1.234,56' } })
  assert.equal(committed.price, 1234.56)
  for (const value of ['', '12abc', '-1', '1.234']) {
    committed = undefined
    input.props.onChange({ target: { value } })
    assert.equal(committed, undefined, value)
    const rerender = DaySchedulePanel({ ...props, priceDrafts: draft })
    const invalid = collect(rerender, node => node.props?.['aria-label'] === 'Valor por hora da faixa 1')[0]
    assert.equal(invalid.props.value, value)
    assert.equal(invalid.props['aria-invalid'], true)
    assert.equal(collect(rerender, node => node.props?.role === 'alert').length, 1)
  }
})

test('price table imperative save blocks invalid drafts before draft or persisted writes', async () => {
  const { priceTableFromLegacyDayConfig, toEditorDays } = loadTypescriptModule('src/modules/courts/lib/price-table-editor.ts')
  const table = priceTableFromLegacyDayConfig('court', 'arena', [config])
  for (const persisted of [false, true]) {
    let handle
    let writes = 0
    let stateIndex = 0
    const react = { ...mockReact, useState(initial) {
      const index = stateIndex++
      if (index === 0) return [{ [`${persisted ? 'table' : table.tipo}:1`]: { 'default-08:00': { value: '', sourcePrice: 100 } } }, () => {}]
      if (index === 1 && persisted) return [[{ ...table, id: 'table', editorDays: toEditorDays(table.days), dirty: true }], () => {}]
      return [typeof initial === 'function' ? initial() : initial, () => {}]
    }, useImperativeHandle(_ref, factory) { handle = factory() } }
    const { PriceTablesConfig } = loadTypescriptModule('src/modules/courts/components/PriceTablesConfig.tsx', {
      react,
      '@/modules/courts/actions/priceTableActions': { upsertCourtPriceTableAction: async () => { writes++; return { success: true } } },
      sonner: { toast: { error() {}, success() {} } },
    })
    PriceTablesConfig({ arenaId: 'arena', ...(persisted ? { courtId: 'court' } : { draftTables: [table], onDraftChange() {} }), ref: {} })
    assert.equal(handle.validate(), false)
    assert.equal(await handle.saveAll(), false)
    assert.equal(writes, 0)
  }
})


test('external hourly price replacement never shows or validates an older draft', () => {
  const { DaySchedulePanel } = loadTypescriptModule('src/modules/courts/components/DaySchedulePanel.tsx', { react: mockReact })
  for (const value of ['99,00', '']) {
    const tree = DaySchedulePanel({ config: { ...config, price: 200 }, onChange() {},
      priceDrafts: { 'default-08:00': { value, sourcePrice: 100 } }, onPriceDraftChange() {} })
    const field = collect(tree, node => node.props?.['aria-label'] === 'Valor por hora da faixa 1')[0]
    assert.equal(field.props.value, '200')
    assert.equal(field.props['aria-invalid'], false)
  }
})

test('deleted tiers/tables and replaced prices cannot leave a stale validation block', () => {
  const { priceTableFromLegacyDayConfig } = loadTypescriptModule('src/modules/courts/lib/price-table-editor.ts')
  const table = priceTableFromLegacyDayConfig('court', 'arena', [{ ...config, price: 200 }])
  for (const drafts of [
    { 'padrao:1': { 'default-08:00': { value: '', sourcePrice: 100 } } },
    { 'padrao:1': { 'removed-tier': { value: '', sourcePrice: 200 } } },
    { 'removed-table:1': { 'default-08:00': { value: '', sourcePrice: 200 } } },
  ]) {
    let stateIndex = 0
    let handle
    const { PriceTablesConfig } = loadTypescriptModule('src/modules/courts/components/PriceTablesConfig.tsx', {
      react: { ...mockReact, useState(initial) {
        if (stateIndex++ === 0) return [drafts, () => {}]
        return [typeof initial === 'function' ? initial() : initial, () => {}]
      }, useImperativeHandle(_ref, factory) { handle = factory() } },
      '@/modules/courts/actions/priceTableActions': {}, sonner: { toast: { error() {}, success() {} } },
    })
    PriceTablesConfig({ arenaId: 'arena', draftTables: [table], onDraftChange() {}, ref: {} })
    assert.equal(handle.validate(), true)
  }
})

function priceTableHarness({ persisted = false, drafts = {}, sourcePrice = 100, twoDays = false } = {}) {
  const { priceTableFromLegacyDayConfig, toEditorDays } = loadTypescriptModule('src/modules/courts/lib/price-table-editor.ts')
  const padrao = priceTableFromLegacyDayConfig('court', 'arena', [config, ...(twoDays ? [{ ...config, day: 'Terça-feira' }] : [])])
  padrao.days = padrao.days.map(day => ({ ...day, basePrice: sourcePrice }))
  const kind = persisted ? 'personalizada' : 'mensalista'
  const target = { ...padrao, tipo: kind, nome: 'Destino', isDefault: false,
    days: padrao.days.map(day => ({ ...day, basePrice: 100 })) }
  let draftTables = [padrao, target]
  const targetKey = persisted ? 'target-id' : kind
  const slots = [drafts, persisted ? draftTables.map(table => ({ ...table,
    id: table.tipo === 'padrao' ? 'source-id' : targetKey, editorDays: toEditorDays(table.days), dirty: false })) : null,
  targetKey, null, false, [1], false, targetKey]
  let cursor = 0, handle
  const requests = [], errors = []
  const text = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.props?.children) : ''
  const react = { ...mockReact, useState(initial) {
    const index = cursor++
    if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
    return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value }]
  }, useImperativeHandle(_ref, factory) { handle = factory() } }
  const { PriceTablesConfig } = loadTypescriptModule('src/modules/courts/components/PriceTablesConfig.tsx', {
    react, '@/modules/courts/actions/priceTableActions': {
      deleteCourtPriceTableAction: async () => { requests.push('delete'); return { success: true } },
      upsertCourtPriceTableAction: async () => { requests.push('save'); return { success: true } },
      listCourtPriceTablesAction: async () => ({ success: true, data: [{ ...padrao, id: 'source-id' }] }),
    }, sonner: { toast: { error: message => errors.push(message), success() {} } },
  }, { confirm: () => true })
  const render = () => {
    cursor = 0
    return PriceTablesConfig({ arenaId: 'arena', ...(persisted ? { courtId: 'court' } : { draftTables, onDraftChange: next => { draftTables = next } }), ref: {} })
  }
  return { render, slots, requests, errors, get handle() { return handle }, get tables() { return draftTables },
    button(label) {
      const button = collect(render(), node => typeof node.props?.onClick === 'function' && text(node).includes(label))[0]
      assert.ok(button, label)
      return button
    } }
}

const invalidDraft = { 'default-08:00': { value: '', sourcePrice: 100 } }

test('copy replaces same-price destination drafts and refuses an invalid source without changing destination', () => {
  const target = priceTableHarness({ drafts: { 'mensalista:1': invalidDraft } })
  target.render()
  assert.equal(target.handle.validate(), false)
  target.button('Copiar faixas da tabela Padrão').props.onClick()
  target.render()
  assert.equal(target.handle.validate(), true)
  assert.equal(target.tables[1].days[0].basePrice, 100)

  const source = priceTableHarness({ drafts: { 'padrao:1': invalidDraft } })
  const before = source.tables
  source.button('Copiar faixas da tabela Padrão').props.onClick()
  source.render()
  assert.equal(source.tables, before)
  assert.equal(source.handle.validate(), false)
  assert.match(source.errors[0], /Padrão/)
})

test('replication clears only replaced days and refuses an invalid leader', () => {
  const target = priceTableHarness({ twoDays: true, drafts: { 'mensalista:2': invalidDraft, 'padrao:1': invalidDraft } })
  target.button('Replicar para todos os dias').props.onClick()
  target.render()
  assert.equal(target.slots[0]['mensalista:2'], undefined)
  assert.ok(target.slots[0]['padrao:1'])
  assert.equal(target.handle.validate(), false, 'another table still blocks save')

  const source = priceTableHarness({ twoDays: true, drafts: { 'mensalista:1': invalidDraft } })
  const before = source.tables
  source.button('Replicar para todos os dias').props.onClick()
  assert.equal(source.tables, before)
  assert.match(source.errors[0], /origem/)
})

test('clearing a table removes its hidden drafts without discarding another table', () => {
  const harness = priceTableHarness({ drafts: { 'mensalista:1': invalidDraft, 'padrao:1': invalidDraft } })
  harness.button('Limpar tabela').props.onClick()
  harness.render()
  assert.equal(harness.slots[0]['mensalista:1'], undefined)
  assert.ok(harness.slots[0]['padrao:1'])
  assert.ok(harness.tables[1].days.every(day => !day.enabled))
})

test('delete ignores only the disappearing table draft and still blocks other invalid tables', async () => {
  const own = priceTableHarness({ persisted: true, drafts: { 'target-id:1': invalidDraft } })
  await own.button('Excluir tabela').props.onClick()
  assert.deepEqual(own.requests, ['delete'])
  own.render()
  assert.equal(Object.keys(own.slots[0]).length, 0)

  const other = priceTableHarness({ persisted: true, drafts: { 'target-id:1': invalidDraft, 'source-id:1': invalidDraft } })
  await other.button('Excluir tabela').props.onClick()
  assert.deepEqual(other.requests, [])
  other.render()
  assert.equal(other.handle.validate(), false)
})


test('copy uses the visible unsaved source prices and preserves their valid draft', () => {
  const sourceDraft = { 'default-08:00': { value: '200,00', sourcePrice: 200 } }
  const harness = priceTableHarness({ persisted: true, drafts: { 'source-id:1': sourceDraft, 'target-id:1': invalidDraft } })
  const source = harness.slots[1][0]
  source.editorDays = source.editorDays.map(day => day.diaSemana === 1 ? { ...day, basePrice: 200 } : day)
  source.dirty = true
  assert.equal(source.days[0].basePrice, 100, 'server snapshot is still the old price')
  harness.button('Copiar faixas da tabela Padrão').props.onClick()
  harness.render()
  assert.equal(harness.slots[1][1].editorDays.find(day => day.diaSemana === 1).basePrice, 200)
  assert.deepEqual(harness.slots[0]['source-id:1'], sourceDraft)
  assert.equal(harness.slots[0]['target-id:1'], undefined)
  assert.equal(harness.handle.validate(), true)
})


test('batch editing discards replaced destination texts while preserving the leader and other tables', () => {
  const validSource = { 'default-08:00': { value: '100,00', sourcePrice: 100 } }
  const harness = priceTableHarness({ twoDays: true, drafts: { 'mensalista:1': validSource, 'mensalista:2': invalidDraft, 'padrao:1': invalidDraft } })
  harness.slots[5] = [1, 2]
  const panel = collect(harness.render(), node => node.type?.name === 'DaySchedulePanel')[0]
  assert.ok(panel)
  panel.props.onChange(config)
  harness.render()
  assert.equal(harness.slots[0]['mensalista:2'], undefined)
  assert.deepEqual(harness.slots[0]['mensalista:1'], validSource)
  assert.ok(harness.slots[0]['padrao:1'])
  assert.equal(harness.handle.validate(), false, 'another table still blocks persistence')
})
