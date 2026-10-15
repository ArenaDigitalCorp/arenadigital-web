import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const paginationUrl = new URL('../src/lib/supabase-pagination.ts', import.meta.url).href
async function loadTypeScript(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
    .replaceAll("'@/lib/supabase-pagination'", JSON.stringify(paginationUrl))
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
}
const { SupabaseAthleteRepository } = await loadTypeScript('../src/modules/athletes/repositories/SupabaseAthleteRepository.ts')
const { listAllAthleteProfiles } = await loadTypeScript('../src/modules/athletes/lib/list-all-athlete-profiles.ts')

function queryFor(rows, failurePage = null) {
  const calls = []
  const query = {
    calls,
    select(value) { calls.push(['select', value]); return query },
    eq(...args) { calls.push(['eq', ...args]); return query },
    order(...args) { calls.push(['order', ...args]); return query },
    ilike(...args) { calls.push(['ilike', ...args]); return query },
    range(from, to) {
      calls.push(['range', from, to])
      if (failurePage === calls.filter(call => call[0] === 'range').length) {
        return Promise.resolve({ data: null, error: { message: 'second page failed' } })
      }
      return Promise.resolve({ data: rows.slice(from, to + 1), error: null })
    },
  }
  return query
}

test('arena list includes all 1,947 clients, preserves scope/search and stable ordering', async () => {
  const rows = Array.from({ length: 1947 }, (_, id) => ({
    id: `athlete-${id}`, nome_perfil: 'Pessoa Exemplo', cpf: null, telefone: null,
    users: { email: 'example@example.test' }, atleta_esportes: [{ sport: { name: 'Beach Tennis' } }],
  }))
  const query = queryFor(rows)
  const repository = new SupabaseAthleteRepository({ from: table => { assert.equal(table, 'atleta'); return query } })
  const result = await repository.findByArena('arena-id', 'Pessoa')
  assert.equal(result.length, 1947)
  assert.equal(result.at(-1).id, 'athlete-1946')
  assert.equal(result.at(-1).sport, 'Beach Tennis')
  assert.equal(result.at(-1).cpf, '---')
  assert.deepEqual(query.calls.filter(call => call[0] === 'eq'), [['eq', 'arenas_atleta.id_arena', 'arena-id']])
  assert.deepEqual(query.calls.filter(call => call[0] === 'order'), [['order', 'nome_perfil', { ascending: true }], ['order', 'id', { ascending: true }]])
  assert.deepEqual(query.calls.filter(call => call[0] === 'ilike'), [['ilike', 'nome_perfil', '%Pessoa%']])
  assert.deepEqual(query.calls.filter(call => call[0] === 'range'), [['range', 0, 999], ['range', 1000, 1999]])
})

test('arena list rejects a failed later page instead of exposing a partial list', async () => {
  const query = queryFor(Array.from({ length: 1947 }, (_, id) => ({ id })), 2)
  const repository = new SupabaseAthleteRepository({ from: () => query })
  await assert.rejects(repository.findByArena('arena-id'), /second page failed/)
})

test('all profiles are loaded, including professors beyond the first 1,000 records', async () => {
  const rows = Array.from({ length: 1947 }, (_, id) => ({
    atleta_id: `athlete-${id}`, papeis: ['padrao'], perfil_sugerido: 'padrao',
    perfil_definido: id === 1946 ? 'professor' : null,
    perfil_efetivo: id === 1946 ? 'professor' : 'padrao',
  }))
  const query = queryFor(rows)
  const { data, error } = await listAllAthleteProfiles({ rpc: (name, args) => {
    assert.equal(name, 'list_atleta_perfis'); assert.deepEqual(args, { p_arena_id: 'arena-id' }); return query
  } }, 'arena-id')
  assert.equal(error, null)
  assert.equal(data.length, 1947)
  assert.equal(data.at(-1).perfil_efetivo, 'professor')
  assert.deepEqual(query.calls.filter(call => call[0] === 'order'), [['order', 'atleta_id']])
  assert.deepEqual(query.calls.filter(call => call[0] === 'range'), [['range', 0, 999], ['range', 1000, 1999]])
})

test('a failed later profile page returns no partial profile map', async () => {
  const query = queryFor(Array.from({ length: 1947 }, (_, id) => ({ atleta_id: `athlete-${id}` })), 2)
  const result = await listAllAthleteProfiles({ rpc: () => query }, 'arena-id')
  assert.equal(result.data, null)
  assert.equal(result.error.message, 'second page failed')
})
