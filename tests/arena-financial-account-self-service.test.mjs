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

test('finance dashboard includes balance, withdrawal and reconciled statement self-service', async () => {
  const page = await source('src/app/dashboard/finance/[arenaId]/page.tsx')
  const dashboard = await source('src/modules/finance/components/FinanceDashboardClient.tsx')
  const card = await source('src/modules/finance/components/ArenaFinancialAccountCard.tsx')

  assert.match(page, /ArenaFinancialAccountCard/u)
  assert.match(page, /financialAccount=\{<ArenaFinancialAccountCard arenaId=\{arenaId\} \/>\}/u)
  assert.match(dashboard, /financialAccount\?: React\.ReactNode/u)
  assert.match(dashboard, /\{financialAccount\}/u)
  assert.match(card, /Saldo de reservas online/u)
  assert.match(card, /Concluir ativação/u)
  assert.match(card, /\/dashboard\/arenas\/\$\{arenaId\}\/edit/u)
  assert.match(card, /Saques da subconta/u)
  assert.match(card, /Extrato Asaas/u)
})
