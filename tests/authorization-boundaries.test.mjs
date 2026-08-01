import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

function exportedFunctionBody(contents, functionName) {
  const start = contents.indexOf(`export async function ${functionName}`)
  assert.notEqual(start, -1, `${functionName} must exist`)
  const next = contents.indexOf('\nexport async function ', start + 1)
  return contents.slice(start, next === -1 ? contents.length : next)
}

test('destructive arena and Pix settings operations remain owner-only', async () => {
  const contents = await source('src/modules/arenas/actions/arenaActions.ts')
  for (const name of ['deleteArenaAction', 'updateArenaPixSplitSettingsAction']) {
    assert.match(exportedFunctionBody(contents, name), /assertArenaOwnerAccess\(arenaId\)/)
  }
})

test('user and finance mutations remain restricted to Owner or Gestor', async () => {
  const userActions = await source('src/modules/users/actions/userActions.ts')
  for (const name of ['createArenaUserAction', 'updateArenaUserAction', 'deleteArenaUserAction']) {
    assert.match(exportedFunctionBody(userActions, name), /assertArenaAdminAccess\(arenaId\)/)
  }

  const financeActions = await source('src/modules/finance/actions/financeActions.ts')
  for (const name of ['createTransactionAction', 'updateTransactionAction', 'deleteTransactionAction']) {
    assert.match(exportedFunctionBody(financeActions, name), /assertArenaAdminAccess\(arenaId\)/)
  }
})

test('configuration mutations reject attendant-level access', async () => {
  const checks = [
    ['src/modules/ai-agent/actions/agentActions.ts', ['updateAgentConfigAction', 'toggleAgentAction', 'connectChannelAction', 'disconnectChannelAction']],
    ['src/modules/courts/actions/courtActions.ts', ['createCourtAction', 'updateCourtAction', 'deleteCourtAction', 'duplicateCourtAction']],
    ['src/modules/stations/actions/stationActions.ts', ['createStationAction', 'updateStationAction']],
    ['src/modules/products/actions/categoryActions.ts', ['createCategoryAction', 'updateCategoryAction', 'deleteCategoryAction']],
    ['src/modules/products/actions/stockActions.ts', ['createProductAction', 'updateProductAction', 'deleteProductAction']],
    ['src/modules/products/actions/priceActions.ts', ['bulkAdjustPricesAction']],
  ]

  for (const [path, names] of checks) {
    const contents = await source(path)
    for (const name of names) {
      assert.match(exportedFunctionBody(contents, name), /assertArenaAdminAccess\(/, `${name} must require arena admin access`)
    }
  }
})

test('station cancellation has one atomic stock restoration path', async () => {
  const page = await source('src/app/dashboard/arenas/[id]/stations/[stationId]/orders/[orderId]/page.tsx')
  assert.doesNotMatch(page, /restoreStockForOrderAction/)

  const orderActions = await source('src/modules/stations/actions/orderActions.ts')
  assert.match(exportedFunctionBody(orderActions, 'updateOrderAction'), /rpc\('cancel_station_order'/)

  const stockActions = await source('src/modules/products/actions/stockActions.ts')
  const legacyCompatibilityAction = exportedFunctionBody(stockActions, 'restoreStockForOrderAction')
  assert.match(legacyCompatibilityAction, /rpc\('cancel_station_order'/)
  assert.doesNotMatch(legacyCompatibilityAction, /from\('product_stock_movements'\)/)
})

test('catalog actions do not pass client-owned records directly to persistence', async () => {
  const stockActions = await source('src/modules/products/actions/stockActions.ts')
  const createProduct = exportedFunctionBody(stockActions, 'createProductAction')
  const updateProduct = exportedFunctionBody(stockActions, 'updateProductAction')

  assert.doesNotMatch(createProduct, /repo\.create\(input\)/)
  assert.match(createProduct, /stock_quantity:\s*0/)
  assert.match(createProduct, /created_by:\s*dbUserId/)
  assert.doesNotMatch(updateProduct, /repo\.update\(productId,\s*input\)/)
  assert.match(updateProduct, /updated_by:\s*dbUserId/)
})
