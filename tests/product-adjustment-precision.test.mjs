import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule as load, realReact } from './helpers/load-typescript-module.mjs'

const { parsePriceAdjustmentInput } = load('src/modules/products/lib/price-adjustment-input.ts')
const productTypes = load('src/modules/products/types/product.types.ts')
const plain = value => JSON.parse(JSON.stringify(value))

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : []
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join('')
  return tree && typeof tree === 'object' ? text(tree.props?.children) : String(tree ?? '')
}
function harness({ raw = '2,555', type = 'percent', rounding = 'exact', kind = 'product', failFirst = false } = {}) {
  const state = ['config', 'category', type, raw, rounding, false, 'Ajuste de teste', false]
  const refs = [], requests = [], notices = [], access = [], calculations = []
  let stateIndex, refIndex, tree, uuidCount = 0
  const { bulkAdjustPricesAction } = load('src/modules/products/actions/priceActions.ts', {
    '@/lib/server-auth': {
      assertArenaAdminAccess: async arena => { access.push(arena) },
      requireAuthenticatedDbUser: async () => ({ dbUserId: 'user-fixture' }),
    },
    '@/lib/supabase-server': { getSupabaseAdmin: () => ({ rpc: async (name, args) => {
      requests.push({ name, args: plain(args) })
      return failFirst && requests.length === 1 ? { data: null, error: { message: 'Simulated transient failure' } }
        : { data: { batchId: args.p_batch_id, adjustedCount: 1 }, error: null }
    } }) },
    'next/cache': { revalidatePath() {} },
  })
  const { BulkPriceAdjustModal } = load('src/modules/products/components/BulkPriceAdjustModal.tsx', {
    react: { ...realReact, useMemo: fn => fn(),
      useState() { const i = stateIndex++; return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next }] },
      useRef(value) { return refs[refIndex++] ??= { current: value } },
    },
    '@/modules/products/types/product.types': { ...productTypes,
      computeAdjustedPrice: (...args) => { calculations.push(args); return productTypes.computeAdjustedPrice(...args) } },
    '@/modules/products/actions/priceActions': { bulkAdjustPricesAction },
    sonner: { toast: { error: message => notices.push(message), success: message => notices.push(message) } },
  }, { crypto: { randomUUID: () => `c2000000-0000-4000-8000-${String(++uuidCount).padStart(12, '0')}` } })
  function render() {
    stateIndex = refIndex = 0
    tree = BulkPriceAdjustModal({ arenaId: 'arena-fixture', kind, open: true, onOpenChange() {}, onSuccess() {},
      categories: [{ id: 'category', name: 'Categoria', kind, active: true }],
      products: [{ id: 'product', name: 'Item de teste', category_id: 'category', price: 1000, status: 'Ativo' }],
    })
  }
  render()
  return { requests, notices, access, calculations,
    input: () => nodes(tree).find(node => node.props?.['aria-label'] === (type === 'percent' ? 'Percentual de reajuste' : 'Valor fixo de reajuste')),
    preview() { nodes(tree).find(node => typeof node.props?.onClick === 'function' && text(node).includes('Ver resumo')).props.onClick(); render() },
    async apply() {
      const button = nodes(tree).find(node => typeof node.props?.onClick === 'function' && text(node).startsWith('Aplicar em'))
      assert.ok(button); assert.equal(button.props.disabled, false)
      await button.props.onClick(); render()
    },
    step: () => state[0], text: () => text(tree),
  }
}

test('percentage input preserves unrestricted fractional precision in comma/dot notation', () => {
  for (const [input, expected] of [['2,555', 2.555], ['2.555', 2.555], ['-2,555', -2.555], ['2,55555', 2.55555], ['+0.12345678', 0.12345678], ['.5', 0.5], [',5', 0.5], ['2,', 2], [' 10 ', 10]]) {
    assert.equal(parsePriceAdjustmentInput(input, 'percent'), expected, input)
  }
  for (const input of ['', ' ', '2,55foo', '2.5.5', '2,5,5', '1.234,56', 'R$ 2,555', 'Infinity', 'NaN', '1e3', '9'.repeat(400)]) {
    assert.equal(parsePriceAdjustmentInput(input, 'percent'), null, input)
  }
})

test('fixed currency input retains its two-decimal BRL contract', () => {
  assert.equal(parsePriceAdjustmentInput('1.234,56', 'fixed'), 1234.56)
  assert.equal(parsePriceAdjustmentInput('-0,50', 'fixed'), -0.5)
  assert.equal(parsePriceAdjustmentInput('2,555', 'fixed'), null)
  assert.equal(parsePriceAdjustmentInput('2.555', 'fixed'), null)
})

test('percentage field keeps the entered precision on blur instead of using monetary presentation', () => {
  const h = harness({ raw: '2,55555' })
  const input = h.input()
  const rendered = input.type(input.props)
  assert.equal(rendered.type, 'input')
  assert.equal(rendered.props.value, '2,55555')
  assert.equal(rendered.props.onBlur, undefined)
  h.preview(); assert.equal(h.step(), 'preview')
  assert.match(h.text(), /2\.55555%/)
})

test('real component/action preserve full percentage through the RPC and existing price-rounding modes', async () => {
  for (const kind of ['product', 'service']) for (const rounding of ['exact', 'end00', 'end50', 'end90']) {
    const h = harness({ kind, rounding })
    h.preview(); assert.equal(h.step(), 'preview')
    assert.equal(h.calculations.at(-1)[2], 2.555)
    assert.equal(h.calculations.at(-1)[3], rounding)
    if (rounding === 'exact') assert.match(h.text(), /1\.025,55/)
    await h.apply()
    assert.equal(h.requests.length, 1)
    assert.deepEqual(h.access, ['arena-fixture'])
    assert.equal(h.requests[0].name, 'bulk_adjust_product_prices')
    assert.equal(h.requests[0].args.p_amount, 2.555)
    assert.equal(h.requests[0].args.p_rounding, rounding)
    assert.equal(h.requests[0].args.p_adjustment_type, 'percent')
    assert.equal(h.requests[0].args.p_arena_id, 'arena-fixture')
    assert.equal(h.requests[0].args.p_changed_by, 'user-fixture')
  }
})

test('discounts, bounds and invalid-input guards keep their previous meaning', async () => {
  const valid = harness({ raw: '-2,555' })
  valid.preview(); assert.match(valid.text(), /974,45/)
  await valid.apply(); assert.equal(valid.requests[0].args.p_amount, -2.555)
  for (const raw of ['0', '-100', '-100,001', '2,55abc']) {
    const h = harness({ raw }); h.preview()
    assert.equal(h.step(), 'config', raw)
    assert.equal(h.requests.length, 0)
    assert.ok(h.notices.length)
  }
  const money = harness({ raw: '-0,50', type: 'fixed' })
  money.preview(); await money.apply()
  assert.equal(money.requests[0].args.p_amount, -0.5)
  assert.equal(money.requests[0].args.p_adjustment_type, 'fixed')
})

test('retry preserves the original batch identity and precise percentage', async () => {
  const h = harness({ raw: '2,55555', failFirst: true })
  h.preview(); await h.apply()
  assert.equal(h.step(), 'preview')
  await h.apply()
  assert.equal(h.requests.length, 2)
  assert.deepEqual(h.requests[1], h.requests[0])
  assert.equal(h.requests[1].args.p_amount, 2.55555)
})
