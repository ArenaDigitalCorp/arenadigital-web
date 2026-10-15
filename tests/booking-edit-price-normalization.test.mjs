import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

const source = readFileSync(new URL('../src/modules/bookings/components/BookingModal.tsx', import.meta.url), 'utf8')
const ast = ts.createSourceFile('BookingModal.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const { parseBrazilianDecimal } = loadTypescriptModule('src/lib/format.ts')

// Execute the production declarations, including both real click handlers. The
// surrounding component's hooks/actions are fixtures; the validation is not copied.
function declaration(name) {
  let found
  function visit(node) {
    if ((ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node)) && node.name?.getText(ast) === name) found = node
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert.ok(found, `Production declaration ${name}`)
  return ts.isVariableDeclaration(found) ? `const ${found.getText(ast)};` : found.getText(ast)
}
const declarations = ['parsedCourtPrice', 'validCourtPrice', 'handleSaveAvulso', 'handlePreSave', 'totalDisplay', 'fmtBrl']
const code = ts.transpileModule(`${declarations.map(declaration).join('\n')}
  globalThis.fixture = { handleSaveAvulso, handlePreSave, totalDisplay, fmtBrl };`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText

function harness(courtPrice) {
  const requests = [], errors = []
  const context = {
    courtPrice, parseBrazilianDecimal,
    bookingType: 'avulso', existingBooking: { id: 'booking' },
    selectedAthlete: { id: 'athlete', nome_perfil: 'Responsável teste' }, search: '',
    avulsoEndTimeError: null, splitBillingPerParticipant: false, serviceLines: [],
    servicesSumDisplay: 7.5, somaPartesRateio: 0,
    selectedDate: new Date('2026-10-15T12:00:00Z'), startTime: '08:00', endTime: '09:00',
    bookingOperationId: { current: null }, crypto: { randomUUID: () => 'operation' },
    isRecurring: false, recurrenceWeeks: 1, addWeeks: date => date,
    arenaId: 'arena', courtId: 'court', selectedSport: '', additionalParticipants: [],
    setIsSaving() {}, setIsCheckingConflicts() {}, setConflicts() {}, trackAction() {},
    toast: { error: message => errors.push(message), success() {} },
    buildSlotsAvulso: () => [{ start_time: '2026-10-15T08:00:00Z', end_time: '2026-10-15T09:00:00Z' }],
    checkBookingConflictsAction: async () => { requests.push({ action: 'conflicts' }); return { success: true, conflicts: [] } },
    saveBackofficeBookingBundleAction: async (_arena, input) => {
      requests.push({ action: 'save', input })
      return { success: false, error: 'Fixture stops after observing the request' }
    },
  }
  vm.runInNewContext(code, context)
  return { ...context.fixture, requests, errors }
}

test('editing avulso accepts BR grouped/comma/dot amounts and preserves explicit free rent', async () => {
  for (const [raw, amount] of [['12,50', 12.5], ['1.234,56', 1234.56], ['1234.56', 1234.56], ['0', 0], ['0,00', 0]]) {
    const fixture = harness(raw)
    await fixture.handlePreSave()
    assert.deepEqual(fixture.requests.map(request => request.action), ['conflicts', 'save'], raw)
    assert.equal(fixture.requests[1].input.updateBookingId, 'booking')
    assert.equal(fixture.requests[1].input.rentalPrice, amount, raw)
    assert.equal(fixture.totalDisplay, amount + 7.5, raw)
    assert.equal(fixture.fmtBrl(fixture.totalDisplay), new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount + 7.5))
  }
})

test('empty, ambiguous and invalid editing prices call neither conflict nor save actions', async () => {
  for (const raw of ['', ' ', '12abc', '1.234', '1.2.3,45', '-1', 'Infinity']) {
    for (const handler of ['handlePreSave', 'handleSaveAvulso']) {
      const fixture = harness(raw)
      await fixture[handler]()
      assert.deepEqual(fixture.requests, [], `${handler}/${raw}`)
      assert.match(fixture.errors[0], /valor válido para a locação/, raw)
      assert.equal(fixture.fmtBrl(fixture.totalDisplay), '—', raw)
    }
  }
})

test('the existing rent field uses DecimalInput and both summaries use the canonical parsed amount', () => {
  let courtInput
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) && node.attributes.properties.some(attribute =>
      ts.isJsxAttribute(attribute) && attribute.name.getText(ast) === 'value' && attribute.initializer?.getText(ast) === '{courtPrice}')) courtInput = node
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert.equal(courtInput?.tagName.getText(ast), 'DecimalInput')
  assert.doesNotMatch(source, /Number\(courtPrice\)/)
  assert.ok(source.includes('Locação {fmtBrl(validCourtPrice ? parsedCourtPrice! : Number.NaN)}'))
})
