import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule, realReact } from './helpers/load-typescript-module.mjs'

const plain = value => JSON.parse(JSON.stringify(value))
const arenaId = 'f1000000-0000-4000-8000-000000000001'
const baseQuery = { page: 1, pageSize: 25, search: '', profile: 'todos', sort: { column: 'name', direction: 'asc' } }
const item = { id: 'athlete', name: 'Fixture', cpf: null, telefone: null, email: null, sport: 'Vôlei', perfil: null }
function response(profilesAvailable, query) {
  return { success: true, data: { page: query.page, pageSize: query.pageSize, total: 67,
    counts: { todos: 67, padrao: profilesAvailable ? 66 : null, mensalista: profilesAvailable ? 0 : null, professor: profilesAvailable ? 1 : null },
    profilesAvailable, items: [{ ...item, perfil: profilesAvailable ? 'professor' : null }] } }
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : []
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join('')
  return tree && typeof tree === 'object' ? text(tree.props?.children) : String(tree ?? '')
}
function harness({ query = baseQuery, read = input => response(false, input) } = {}) {
  const state = [query], effects = [], timers = [], calls = []
  let stateIndex, effectIndex, dirty, tree
  const react = { ...realReact,
    useState(initial) {
      const i = stateIndex++
      if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial
      return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next; dirty = true }]
    },
    useEffect(fn, deps) {
      const i = effectIndex++, previous = effects[i]
      if (!previous || deps.some((value, j) => !Object.is(value, previous.deps[j]))) {
        previous?.cleanup?.()
        effects[i] = { deps, cleanup: fn() }
      }
    },
  }
  const { AthletesList } = loadTypescriptModule('src/modules/athletes/components/AthletesList.tsx', {
    react, './AthletesTable': { AthletesTable: 'AthletesTable' },
    '@/modules/athletes/actions/athleteActions': { getAthletesPageAction: async input => { calls.push(input); return read(input) } },
  }, { setTimeout(fn) { const timer = { fn }; timers.push(timer); return timer }, clearTimeout(timer) { timer.cancelled = true } })
  function render() {
    stateIndex = effectIndex = 0; dirty = false
    const wrapper = AthletesList({ arenaId }); tree = wrapper.type(wrapper.props)
  }
  async function flush() {
    for (let i = 0; i < 12; i++) {
      if (dirty) render()
      while (timers.length) { const timer = timers.shift(); if (!timer.cancelled) await timer.fn() }
      await Promise.resolve()
      if (!dirty && !timers.length) return
    }
    throw new Error('Listing did not settle')
  }
  render()
  return { calls, flush, tree: () => tree, table: () => nodes(tree).find(node => node.type === 'AthletesTable').props,
    retry: () => nodes(tree).find(node => typeof node.props?.onClick === 'function' && text(node).includes('Tentar carregar os perfis')).props.onClick() }
}

test('unavailable profiles keep real rows, totals and 25/50 pagination without inventing roles', async () => {
  for (const pageSize of [25, 50]) {
    const h = harness({ query: { ...baseQuery, page: 2, pageSize } })
    await h.flush()
    assert.equal(h.table().athletes[0].name, 'Fixture')
    assert.equal(h.table().page, 2)
    assert.equal(h.table().pageSize, pageSize)
    assert.equal(h.table().total, 67)
    assert.deepEqual(plain(h.table().perfis), {})
    assert.equal(h.table().profilesAvailable, false)
    assert.equal(h.table().error, undefined)
    assert.match(text(h.tree()), /Perfis temporariamente indisponíveis/)
    assert.equal(nodes(h.tree()).filter(node => node.props?.['aria-pressed'] !== undefined).length, 0)
    h.table().onPageChange(3); await h.flush()
    assert.equal(h.calls.at(-1).page, 3)
    assert.equal(h.calls.at(-1).pageSize, pageSize)
  }
})

test('stale profile filter/order reset without losing search, page size or direction', async () => {
  const h = harness({ query: { page: 4, pageSize: 50, search: 'Ágata %_', profile: 'professor', sort: { column: 'perfil', direction: 'desc' } } })
  await h.flush()
  assert.equal(h.calls.length, 2)
  assert.deepEqual(plain(h.calls.at(-1)), { arenaId, page: 1, pageSize: 50, search: 'Ágata %_', profile: 'todos', sort: { column: 'name', direction: 'desc' } })
  assert.equal(h.table().profilesAvailable, false)
  assert.equal(h.table().athletes.length, 1)
})

test('retry restores real profiles and filters without fabricating or persisting a default', async () => {
  let healthy = false
  const h = harness({ read: query => response(healthy, query) })
  await h.flush(); assert.deepEqual(plain(h.table().perfis), {})
  healthy = true; h.retry(); await h.flush()
  assert.equal(h.table().profilesAvailable, true)
  assert.deepEqual(plain(h.table().perfis), { athlete: 'professor' })
  assert.equal(nodes(h.tree()).filter(node => node.props?.['aria-pressed'] !== undefined).length, 4)
  assert.doesNotMatch(text(h.tree()), /Perfis temporariamente indisponíveis/)
})

test('previous RPC version remains compatible and required-data/permission errors remain errors', async () => {
  const old = harness({ read: query => { const result = response(true, query); delete result.data.profilesAvailable; return result } })
  await old.flush(); assert.deepEqual(plain(old.table().perfis), { athlete: 'professor' })
  const failed = harness({ read: () => ({ success: false, error: 'permission denied' }) })
  await failed.flush()
  assert.equal(failed.table().error, 'permission denied')
  assert.equal(failed.table().athletes.length, 0)
  assert.equal(failed.calls.length, 1)
})

test('table shows a dash for unknown profiles and disables only profile sorting', () => {
  const { AthletesTable } = loadTypescriptModule('src/modules/athletes/components/AthletesTable.tsx', { 'next/navigation': { useRouter: () => ({ push() {} }) } })
  const tree = AthletesTable({ athletes: [item], isLoading: false, arenaId, perfis: {}, profilesAvailable: false,
    onRetry() {}, page: 1, pageSize: 25, total: 67, onPageChange() {}, onPageSizeChange() {}, sort: baseQuery.sort, onSortChange() {} })
  assert.ok(nodes(tree).some(node => node.type === 'span' && node.props.children === '—'))
  assert.doesNotMatch(text(tree), /Cliente padrão|Professor/)
  for (const header of nodes(tree).filter(node => typeof node.type === 'function' && node.props?.coluna)) {
    const button = header.type(header.props)
    assert.equal(button.props.disabled, header.props.coluna === 'perfil')
  }
})
