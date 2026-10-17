import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule, realReact } from './helpers/load-typescript-module.mjs'

const { parsePositiveInteger, parseRotativoAmount, parseRotativoPackages } = loadTypescriptModule('src/modules/rotativos/utils/rotativo-input.ts')

test('rotativo values accept Brazilian grouping without accepting numeric prefixes or inventing zero', () => {
  assert.equal(parseRotativoAmount('1.234,56'), 1234.56)
  assert.equal(parseRotativoAmount('R$ 1.234,56'), 1234.56)
  assert.equal(parseRotativoAmount('1234.56'), 1234.56)
  for (const value of ['', '12abc', '1.2.3,45', '1.234', '-10', '0']) assert.equal(parseRotativoAmount(value), null, value)
  const parsed = parseRotativoPackages([{ quantidade: '12', valor_reais: '1.234,56' }])
  assert.equal(parsed[0].quantidade, 12)
  assert.equal(parsed[0].valor_reais, 1234.56)
  assert.equal(parseRotativoPackages([{ quantidade: '1', valor_reais: '0,00' }])[0].valor_reais, 0)
})

test('package and participant quantities validate the entire integer before conversion', () => {
  assert.equal(parsePositiveInteger(' 12 '), 12)
  for (const quantity of ['1.5', '1,5', '12abc', '1e2', '-1', '0', '', '9007199254740993']) {
    assert.equal(parsePositiveInteger(quantity), null, quantity)
    assert.equal(parseRotativoPackages([{ quantidade: quantity, valor_reais: '30,00' }]), null, quantity)
  }
  for (const amount of ['12abc', '1.2.3,45', '1.234', '']) {
    assert.equal(parseRotativoPackages([{ quantidade: '1', valor_reais: amount }]), null, amount)
  }
})

function hooks(firstState) {
  let stateIndex = 0
  return { ...realReact,
    useState: initial => [stateIndex++ === 0 && firstState !== undefined ? firstState : typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect() {}, useRef: initial => ({ current: initial }), useMemo: fn => fn(),
    useTransition: () => [false, fn => fn()],
  }
}

function elements(node, predicate) {
  const result = []
  function visit(value) {
    if (Array.isArray(value)) return value.forEach(visit)
    if (!value || typeof value !== 'object') return
    if (predicate(value)) result.push(value)
    visit(value.props?.children)
  }
  visit(node)
  return result
}

test('credit package save handler sends the full amount and never submits invalid drafts', async () => {
  for (const [quantity, amount, expected] of [['2', '1.234,56', 1234.56], ['1.5', '30,00', null], ['1', '12abc', null]]) {
    let request
    const { CreditosTab } = loadTypescriptModule('src/modules/rotativos/components/CreditosTab.tsx', {
      react: hooks([{ quantidade: quantity, valor_reais: amount }]),
      'react-hook-form': { useForm: () => ({ watch: () => '1', handleSubmit: fn => fn, control: {} }) },
      '@/modules/rotativos/actions/rotativoActions': { saveRotativoPacotesAction: async input => { request = input; return { success: true } } },
      '@/modules/athletes/actions/athleteActions': {}, '@/modules/finance/actions/financeActions': {},
      sonner: { toast: { error() {}, success() {} } },
    })
    const tree = CreditosTab({ arenaId: 'arena', initialPacotes: [], initialMovements: [], initialMovementsTotal: 0, initialTopAthletes: [] })
    const save = elements(tree, element => [element.props?.children].flat().includes('Salvar') && typeof element.props?.onClick === 'function')[0]
    assert.ok(save)
    await save.props.onClick()
    if (expected === null) assert.equal(request, undefined)
    else assert.equal(request.pacotes[0].valor_reais, expected)
  }
})

test('session submit handler rejects invalid prices and fractional participant limits before calling actions', async () => {
  for (const [amount, limit, expected] of [['1.234,56', '12', 1234.56], ['12abc', '12', null], ['30,00', '1.5', null]]) {
    let request
    let submit
    const errors = []
    const { RotativoFormModal } = loadTypescriptModule('src/modules/rotativos/components/RotativoSessionModals.tsx', {
      react: hooks(),
      'react-hook-form': { useForm: () => ({ watch: field => field === 'limitado' ? true : [],
        handleSubmit: fn => { submit = fn; return fn }, setError: (field, error) => errors.push([field, error.message]), control: {} }) },
      '@/modules/rotativos/actions/rotativoActions': { createRotativoAction: async input => { request = input; return { success: true } } },
      sonner: { toast: { error() {}, success() {} } },
    })
    RotativoFormModal({ arenaId: 'arena', isOpen: true, sports: [], courts: [], onClose() {}, onSuccess() {} })
    await submit({ data: '2026-10-15', id_esporte: 'sport', court_ids: [], hora_inicio: '08:00', hora_fim: '09:00', valor: amount, limitado: true, limite_participantes: limit })
    if (expected === null) { assert.equal(request, undefined); assert.equal(errors.length, 1) }
    else { assert.equal(request.valor, expected); assert.equal(request.limite_participantes, 12) }
  }
})

test('bulk price adjustment preview accepts BR grouping and blocks malformed pasted text', () => {
  for (const [input, accepted] of [['1.234,56', true], ['1234.56', true], ['12abc', false], ['1.2.3,45', false], ['1.234', false]]) {
    let stateIndex = 0
    let nextStep
    const state = ['config', 'category', 'fixed', input, 'exact', false, '', false]
    const { BulkPriceAdjustModal } = loadTypescriptModule('src/modules/products/components/BulkPriceAdjustModal.tsx', {
      react: { ...hooks(), useState: () => {
        const index = stateIndex++
        return [state[index], value => { if (index === 0) nextStep = value }]
      } },
      '@/modules/products/actions/priceActions': {},
      sonner: { toast: { error() {}, success() {} } },
    })
    const tree = BulkPriceAdjustModal({ arenaId: 'arena', kind: 'product', open: true, onOpenChange() {}, onSuccess() {},
      categories: [{ id: 'category', name: 'Categoria', kind: 'product', active: true }],
      products: [{ id: 'product', name: 'Produto', price: 10, category_id: 'category', status: 'Ativo' }],
    })
    const preview = elements(tree, element => [element.props?.children].flat().includes('Ver resumo') && typeof element.props?.onClick === 'function')[0]
    assert.ok(preview)
    preview.props.onClick()
    assert.equal(nextStep === 'preview', accepted, input)
  }
})
