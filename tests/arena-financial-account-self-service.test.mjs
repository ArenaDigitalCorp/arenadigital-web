import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

function exportedFunctionBody(contents, functionName) {
  const start = contents.indexOf(`export async function ${functionName}`)
  assert.notEqual(start, -1, `${functionName} must exist`)
  const next = contents.indexOf('\nexport async function ', start + 1)
  return contents.slice(start, next === -1 ? contents.length : next)
}

test('financial self-service operations are arena-admin scoped and delegated to the protected Edge Function', async () => {
  const actions = await source('src/modules/finance/actions/arenaFinancialAccountActions.ts')

  assert.match(actions, /await assertArenaAdminAccess\(arenaId\)/u)
  assert.match(actions, /functions\.invoke\('arena-financial-operations'/u)

  for (const functionName of [
    'getArenaFinancialOverviewAction',
    'configureArenaWithdrawalDestinationAction',
    'requestArenaWithdrawalAction',
  ]) {
    const body = exportedFunctionBody(actions, functionName)
    assert.match(body, /invokeArenaFinancial/u, `${functionName} must use the protected boundary`)
    assert.doesNotMatch(body, /from\(['"]arena_(?:withdrawal|financial)/u)
  }
})

test('withdrawal UI sends an idempotent operation and only renders a masked destination', async () => {
  const card = await source('src/modules/finance/components/ArenaFinancialAccountCard.tsx')
  const types = await source('src/modules/finance/types/arena-financial-account.types.ts')

  assert.match(card, /crypto\.randomUUID\(\)/u)
  assert.match(card, /withdrawalOperationId/u)
  assert.match(card, /overview\.destination\.maskedPixKey/u)
  assert.doesNotMatch(types, /pixKey:\s*string/u)
  assert.doesNotMatch(types, /apiKey|accessToken|walletSecret/iu)
})

test('receiving settings exclusively own balance, Pix and withdrawal controls', async () => {
  const editPage = await source('src/app/dashboard/arenas/[id]/edit/page.tsx')
  const financePage = await source('src/app/dashboard/finance/[arenaId]/page.tsx')
  const dashboard = await source('src/modules/finance/components/FinanceDashboardClient.tsx')
  const card = await source('src/modules/finance/components/ArenaFinancialAccountCard.tsx')

  assert.match(editPage, /<ArenaFinancialAccountCard arenaId=\{id\} \/>/u)
  assert.match(editPage, /Dados de recebimento/u)
  assert.doesNotMatch(financePage, /ArenaFinancialAccountCard/u)
  assert.doesNotMatch(dashboard, /financialAccountActivity/u)
  assert.match(card, /Disponível para saque/u)
  assert.match(card, /Destino Pix do saque/u)
  assert.match(card, /Ir para o cadastro/u)
  assert.match(card, /tab=receiving#receiving-account-title/u)
  assert.doesNotMatch(card, /Saques da subconta|Extrato Asaas/u)
})
