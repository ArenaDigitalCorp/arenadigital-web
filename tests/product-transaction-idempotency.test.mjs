import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const stockActions = readFileSync(
  new URL('../src/modules/products/actions/stockActions.ts', import.meta.url),
  'utf8',
)
const priceActions = readFileSync(
  new URL('../src/modules/products/actions/priceActions.ts', import.meta.url),
  'utf8',
)
const stockModal = readFileSync(
  new URL('../src/modules/products/components/StockEntryModal.tsx', import.meta.url),
  'utf8',
)
const priceModal = readFileSync(
  new URL('../src/modules/products/components/BulkPriceAdjustModal.tsx', import.meta.url),
  'utf8',
)

test('stock entry action forwards only the stable operation id and canonical fields', () => {
  assert.match(stockActions, /operation_id: string/)
  assert.match(stockActions, /p_operation_id: input\.operation_id/)
  assert.match(stockActions, /p_registered_by: dbUserId/)
  assert.doesNotMatch(stockActions, /p_registered_by: input\./)
})

test('stock modal retains its operation id across failures and rotates it after close', () => {
  assert.match(stockModal, /const operationId = useRef<string \| null>\(null\)/)
  assert.match(stockModal, /operation_id: operationId\.current/)
  assert.match(stockModal, /if \(open && operationId\.current === null\)/)
  assert.match(stockModal, /else if \(!open\)[\s\S]{0,80}operationId\.current = null/)
  assert.match(stockModal, /if \(!res\.success\) throw[\s\S]{0,100}operationId\.current = null/)
})

test('bulk modal binds one batch id to one canonical client payload', () => {
  assert.match(priceActions, /batch_id: string/)
  assert.match(priceActions, /const batchId = input\.batch_id/)
  assert.doesNotMatch(priceActions, /randomUUID/)
  assert.match(priceModal, /batchOperation = useRef<\{ id: string; payload: string \} \| null>/)
  assert.match(priceModal, /batchOperation\.current\?\.payload !== payload/)
  assert.match(priceModal, /batch_id: batchOperation\.current\.id/)
})
