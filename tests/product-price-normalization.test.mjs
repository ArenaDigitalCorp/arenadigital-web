import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule, realReact } from './helpers/load-typescript-module.mjs'

const { productFormSchema, serviceFormSchema } = loadTypescriptModule('src/modules/products/schemas/product-form.schema.ts')
const fields = { name: 'Item de teste', category_id: 'category', station_type_id: 'station', status: 'Ativo' }

test('product and service forms require an explicit valid price and accept Brazilian grouping', () => {
  for (const schema of [productFormSchema, serviceFormSchema]) {
    for (const price of ['', ' ', '12abc', '1.2.3,45', '1.234', '-1']) assert.equal(schema.safeParse({ ...fields, price }).success, false, price)
    for (const price of ['0', '0,00', '1.234,56', '1234.56']) assert.equal(schema.safeParse({ ...fields, price }).success, true, price)
  }
})

test('real create and update handlers send canonical product/service prices and block invalid text', async () => {
  for (const kind of ['product', 'service']) {
    for (const editing of [false, true]) {
      for (const [rawPrice, expected] of [['1.234,56', 1234.56], ['0,00', 0], ['', null], ['12abc', null]]) {
        let request
        let successCount = 0
        const submits = []
        const { ProductFormModal } = loadTypescriptModule('src/modules/products/components/ProductFormModal.tsx', {
          react: { ...realReact, useState: initial => [initial, () => {}], useEffect() {} },
          'react-hook-form': { useForm: () => ({ handleSubmit: fn => { submits.push(fn); return fn }, control: {}, reset() {} }) },
          '@/modules/products/actions/stockActions': {
            createProductAction: async (_arena, input) => { request = { action: 'create', input }; return { success: true } },
            updateProductAction: async (_arena, _id, input) => { request = { action: 'update', input }; return { success: true } },
          },
          '@/lib/telemetry/client': { trackAction() {} },
          sonner: { toast: { error() {}, success() {} } },
        }, { console: { ...console, error() {} } })
        const tree = ProductFormModal({ arenaId: 'arena', open: true, catalogKind: kind,
          product: editing ? { id: 'item', name: 'Item', price: 10, catalog_kind: kind, category_id: 'category', station_type_id: 'station', status: 'Ativo' } : null,
          stationTypes: [{ id: 'station', name: 'Estação' }], categories: [{ id: 'category', name: 'Categoria', kind, active: true }],
          onSuccess: () => { successCount++ }, onOpenChange() {},
        })
        function inner(node) {
          if (Array.isArray(node)) return node.map(inner).find(Boolean)
          if (!node || typeof node !== 'object') return null
          if (node.type?.name === 'ProductFormInner') return node
          return inner(node.props?.children)
        }
        const component = inner(tree)
        assert.ok(component)
        component.type(component.props)
        await submits[kind === 'product' ? 0 : 1]({ ...fields, price: rawPrice })
        if (expected === null) {
          assert.equal(request, undefined, `${kind}/${editing}/${rawPrice}`)
          assert.equal(successCount, 0)
        } else {
          assert.equal(request.action, editing ? 'update' : 'create')
          assert.equal(request.input.price, expected)
          assert.equal(successCount, 1)
        }
      }
    }
  }
})
