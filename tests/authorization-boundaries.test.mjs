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

test('destructive arena operations remain owner-only and Pix settings are super-admin only', async () => {
  const contents = await source('src/modules/arenas/actions/arenaActions.ts')
  assert.match(exportedFunctionBody(contents, 'deleteArenaAction'), /assertArenaOwnerAccess\(arenaId\)/)

  for (const name of ['getArenaPixSplitSettingsAction', 'updateArenaPixSplitSettingsAction']) {
    const body = exportedFunctionBody(contents, name)
    assert.match(body, /assertPlatformSuperAdminAccess\(\)/, `${name} must require super admin access`)
    assert.doesNotMatch(body, /assertArenaOwnerAccess\(arenaId\)/, `${name} must not be owner-managed`)
  }
})

test('Pix split configuration lives only in the independent Super Admin backoffice', async () => {
  const editPage = await source('src/app/dashboard/arenas/[id]/edit/page.tsx')
  assert.doesNotMatch(editPage, /ArenaPixSplitSettingsCard/)
  assert.doesNotMatch(editPage, /getArenaPixSplitSettingsAction/)

  const platformConsole = await source('src/modules/platform-admin/components/PlatformAdminConsole.tsx')
  assert.doesNotMatch(platformConsole, /ArenaPixSplitSettingsCard/)

  const superAdminWorkspace = await source('src/modules/super-admin/components/SuperAdminWorkspace.tsx')
  assert.match(superAdminWorkspace, /ArenaPixSplitSettingsCard/)
  assert.match(superAdminWorkspace, /Pix e split por arena/)

  const platformActions = await source('src/modules/platform-admin/actions/platformAdminActions.ts')
  assert.match(platformActions, /from\('arena_payment_accounts'\)/)
  assert.match(platformActions, /pixSplitSettings/)

  const pixCard = await source('src/modules/arenas/components/ArenaPixSplitSettingsCard.tsx')
  assert.match(pixCard, /platformFeeBasisPoints/)
  const updatePix = exportedFunctionBody(await source('src/modules/arenas/actions/arenaActions.ts'), 'updateArenaPixSplitSettingsAction')
  assert.match(updatePix, /platform_fee_basis_points: platformFeeBasisPoints/)
  assert.doesNotMatch(updatePix, /platform_fee_basis_points: 200/)
})

test('super admin backoffice has an independent super-admin-only layout', async () => {
  const serverAuth = await source('src/lib/server-auth.ts')
  assert.match(serverAuth, /export async function assertPlatformSuperAdminAccess/)
  assert.match(exportedFunctionBody(serverAuth, 'assertPlatformSuperAdminAccess'), /profile\.accessLevel !== 'super_admin'/)

  const platformPage = await source('src/app/dashboard/admin/platform/page.tsx')
  assert.match(platformPage, /accessLevel === 'super_admin'/)
  assert.match(platformPage, /redirect\('\/admin\/overview'\)/)

  const legacyPage = await source('src/app/dashboard/admin/super-admin/page.tsx')
  assert.match(legacyPage, /redirect\('\/admin\/overview'\)/)

  const adminLayout = await source('src/app/admin/layout.tsx')
  assert.match(adminLayout, /assertPlatformSuperAdminAccess/)
  assert.match(adminLayout, /SuperAdminShell/)
  assert.doesNotMatch(adminLayout, /DashboardLayoutWrapper|ArenaProvider|DashboardSubscriptionGate/)

  const sidebar = await source('src/components/dashboard/Sidebar.tsx')
  assert.match(sidebar, /const isPlatformAdmin = dbUser\?\.platform_access_level === "platform_admin"/)
  assert.doesNotMatch(sidebar, /href="\/dashboard\/admin\/super-admin"/)

  const userMenu = await source('src/components/auth/UserMenu.tsx')
  assert.match(userMenu, /=== 'super_admin'/)
  assert.match(userMenu, /Painel admin/)
  assert.match(userMenu, /router\.push\('\/admin\/overview'\)/)

  const dashboardPage = await source('src/app/dashboard/page.tsx')
  assert.doesNotMatch(dashboardPage, /platform_access_level === 'super_admin'[\s\S]{0,120}router\.replace/)

  const subscriptionGate = await source('src/components/dashboard/DashboardSubscriptionGate.tsx')
  assert.match(subscriptionGate, /const isGlobalAdminRoute = pathname\.startsWith\('\/dashboard\/admin'\)/)
  assert.match(subscriptionGate, /isGlobalAdminRoute \|\| isTutorialAccess/)

  const shell = await source('src/modules/super-admin/components/SuperAdminShell.tsx')
  assert.match(shell, /Voltar para minha arena/)
  assert.match(shell, /\/admin\/arenas/)
  assert.match(shell, /\/admin\/finance/)
  assert.match(shell, /\/admin\/athletes/)
  assert.match(shell, /\/admin\/engagement/)
})

test('platform principal management protects the last active super admin', async () => {
  const actions = await source('src/modules/platform-admin/actions/platformAdminActions.ts')
  const managePrincipal = exportedFunctionBody(actions, 'managePlatformPrincipalAction')
  assert.match(managePrincipal, /activeSuperAdmins\.length === 1/)
  assert.match(managePrincipal, /removesSuperAdminContinuity/)
  assert.match(managePrincipal, /último superadmin ativo/)
})

test('internal employee plan management is super-admin only', async () => {
  const actions = await source('src/modules/platform-admin/actions/platformAdminActions.ts')
  assert.match(exportedFunctionBody(actions, 'manageInternalEmployeePlanAction'), /assertPlatformSuperAdminAccess\(\)/)
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
