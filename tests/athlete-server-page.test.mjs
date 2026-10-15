import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)
async function load(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
    .replace("from 'zod'", `from ${JSON.stringify(new URL(`file://${require.resolve('zod')}`).href)}`)
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
}
const { athletePageSchema, fetchAthletePage } = await load('../src/modules/athletes/lib/athlete-page.ts')
const { paginationPages } = await load('../src/modules/athletes/lib/pagination-pages.ts')
const { tutorialAthletePage } = await load('../src/modules/athletes/lib/tutorial-athlete-page.ts')
const arenaId = 'f1000000-0000-4000-8000-000000000001'
const query = { page: 40, pageSize: 50, search: 'Ágata %_', profile: 'professor', sort: { column: 'perfil', direction: 'desc' } }

test('server page preserves arena, page size, global search/filter/sort in one RPC', async () => {
  const page = { page: 40, pageSize: 50, total: 1947, items: [], counts: { todos: 1947, padrao: 1927, mensalista: 0, professor: 20 } }
  const client = { rpc: async (name, args) => {
    assert.equal(name, 'list_arena_athletes_page')
    assert.deepEqual(args, { p_arena_id: arenaId, p_page: 40, p_page_size: 50, p_search: 'Ágata %_', p_profile: 'professor', p_sort_by: 'perfil', p_sort_direction: 'desc' })
    return { data: page, error: null }
  } }
  assert.equal(await fetchAthletePage(client, arenaId, query), page)
})

test('only 25 or 50 rows can be requested; invalid arena/filter/sort/search are rejected', () => {
  for (const pageSize of [25, 50]) assert.equal(athletePageSchema.parse({ arenaId, ...query, pageSize }).pageSize, pageSize)
  for (const change of [{ arenaId: 'bad' }, { page: 0 }, { pageSize: 20 }, { pageSize: 1000 }, { profile: 'admin' }, { sort: { column: 'cpf', direction: 'asc' } }, { search: 'x'.repeat(121) }]) {
    assert.equal(athletePageSchema.safeParse({ arenaId, ...query, ...change }).success, false)
  }
})

test('failed or oversized RPC response never exposes a partial or unlimited page', async () => {
  await assert.rejects(fetchAthletePage({ rpc: async () => ({ error: { message: 'permission denied' }, data: null }) }, arenaId, query), /permission denied/)
  for (const data of [null, { pageSize: 25, items: [] }, { pageSize: 50, items: Array(51).fill({}) }]) {
    await assert.rejects(fetchAthletePage({ rpc: async () => ({ error: null, data }) }, arenaId, query), /Resposta inválida/)
  }
})

test('pagination links stay compact on first, middle and last pages', () => {
  assert.deepEqual(paginationPages(1, 78), [1, 2, 'ellipsis', 78])
  assert.deepEqual(paginationPages(40, 78), [1, 'ellipsis', 39, 40, 41, 'ellipsis', 78])
  assert.deepEqual(paginationPages(78, 78), [1, 'ellipsis', 77, 78])
  assert.deepEqual(paginationPages(1, 1), [1])
})

test('tutorial remains local, paginated and searchable beyond the first page', () => {
  const rows = Array.from({ length: 1947 }, (_, id) => ({ id: String(id), name: `Pessoa ${String(id).padStart(4, '0')}`, sport: 'Vôlei', cpf: null, telefone: null, email: null }))
  const base = { ...query, page: 1, pageSize: 25, search: '', profile: 'todos', sort: { column: 'name', direction: 'asc' } }
  const first = tutorialAthletePage(rows, base)
  const second = tutorialAthletePage(rows, { ...base, page: 2 })
  assert.equal(first.items.length, 25)
  assert.equal(second.items[0].id, '25')
  assert.equal(first.counts.todos, 1947)
  assert.equal(tutorialAthletePage(rows, { ...base, pageSize: 50 }).items.length, 50)
  assert.equal(tutorialAthletePage(rows, { ...base, page: 999 }).items.length, 22)
  assert.equal(tutorialAthletePage(rows, { ...base, search: '1946' }).items[0].id, '1946')
  assert.equal(tutorialAthletePage(rows, { ...base, profile: 'professor' }).total, 0)
  assert.equal(tutorialAthletePage(rows, { ...base, search: 'missing' }).page, 1)
})
