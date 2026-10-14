import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

function exportedFunctionBody(contents, name) {
  const start = contents.indexOf(`export async function ${name}`)
  assert.ok(start >= 0, `${name} not found`)
  const next = contents.indexOf('\nexport ', start + 1)
  return next === -1 ? contents.slice(start) : contents.slice(start, next)
}

test('reading transaction categories is open to any active arena member', async () => {
  const actions = await source('src/modules/finance/actions/transactionCategoryActions.ts')
  assert.match(exportedFunctionBody(actions, 'getTransactionCategoriesAction'), /assertArenaAccess\(arenaId\)/)
})

test('writing transaction categories (create/update/delete) is admin-only', async () => {
  const actions = await source('src/modules/finance/actions/transactionCategoryActions.ts')
  for (const name of [
    'createTransactionCategoryAction',
    'updateTransactionCategoryAction',
    'deleteTransactionCategoryAction',
  ]) {
    assert.match(exportedFunctionBody(actions, name), /assertArenaAdminAccess\(arenaId\)/, `${name} must require admin access`)
  }
})

test('deleting a category checks usage by name+type before removing it, never by id alone', async () => {
  const actions = await source('src/modules/finance/actions/transactionCategoryActions.ts')
  const body = exportedFunctionBody(actions, 'deleteTransactionCategoryAction')
  assert.match(body, /from\('transactions'\)/)
  assert.match(body, /\.eq\('type', category\.type\)/)
  assert.match(body, /\.eq\('category', category\.name\)/)
  assert.match(body, /count/)
})

test('TransactionForm sources "Tipo de lançamento" from the arena cadastro, not a hardcoded list', async () => {
  const form = await source('src/modules/finance/components/TransactionForm.tsx')
  assert.match(form, /getTransactionCategoriesAction\(arenaId\)/)
  assert.doesNotMatch(form, /\["Mensalidade", "Bar", "Loja", "Aluguel", "Serviços da Arena"\]/)
})
