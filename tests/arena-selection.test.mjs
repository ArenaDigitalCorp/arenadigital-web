import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const arenas = [{ id: 'arena-a', name: 'Arena A' }, { id: 'arena-b', name: 'Arena B' }]
const jsx = (type, props) => ({ type, props })
function load(path, mocks) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const loadedModule = { exports: {} }
  vm.runInNewContext(code, { module: loadedModule, exports: loadedModule.exports, require: (name) => mocks[name] ?? (name === 'react/jsx-runtime' ? { jsx, jsxs: jsx } : require(name)), fetch: async () => ({ ok: true, json: async () => arenas }) })
  return loadedModule.exports
}

test('selection remains on the new arena while navigation leaves an arena-scoped route; deep links still synchronize', async () => {
  const slots = [], pending = []
  let cursor = 0, pathname = '/dashboard/arenas/arena-a/stations/station-a'
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = initial
      return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value }]
    },
    useReducer(reducer, initial) {
      const [state, set] = react.useState(initial)
      return [state, (action) => set((current) => reducer(current, action))]
    },
    useCallback(fn, deps) {
      const index = cursor++, previous = slots[index]
      if (!previous || deps.some((dep, i) => dep !== previous.deps[i])) slots[index] = { deps, fn }
      return slots[index].fn
    },
    useEffect(fn, deps) {
      const index = cursor++, previous = slots[index]
      if (!previous || deps.some((dep, i) => dep !== previous[i])) pending.push(fn)
      slots[index] = deps
    },
  }
  const user = { id: 'test-user' }
  const { ArenaProvider } = load('src/contexts/ArenaContext.tsx', { react, '@/contexts/UserContext': { useDbUser: () => ({ dbUser: user }) }, 'next/navigation': { usePathname: () => pathname } })
  async function render() {
    cursor = 0
    const tree = ArenaProvider({ children: null })
    for (const effect of pending.splice(0)) await effect()
    await new Promise((resolve) => setImmediate(resolve))
    return tree.props.value
  }
  await render(); await render()
  const initial = await render()
  assert.equal(initial.selectedArena, 'arena-a')
  initial.setSelectedArena('arena-b')
  await render()
  assert.equal((await render()).selectedArena, 'arena-b')
  pathname = '/dashboard'
  await render()
  assert.equal((await render()).selectedArena, 'arena-b')
  pathname = '/dashboard/arenas/arena-a'
  await render()
  assert.equal((await render()).selectedArena, 'arena-a')
})

for (const isCollapsed of [false, true]) {
  test(`selector navigates away from old resources and rejects unknown arenas (collapsed=${isCollapsed})`, () => {
    const selected = [], routes = []
    const context = { arenas, selectedArena: 'arena-a', setSelectedArena: (id) => selected.push(id), isLoadingArenas: false }
    const { ArenaSelector } = load('src/components/dashboard/ArenaSelector.tsx', {
      '@/contexts/ArenaContext': { useArena: () => context },
      'next/navigation': { useRouter: () => ({ push: (path) => routes.push(path) }) },
      '@/components/ui/select': Object.fromEntries(['Select', 'SelectContent', 'SelectItem', 'SelectTrigger', 'SelectValue'].map((name) => [name, name])),
      '@/components/ui/skeleton': { Skeleton: 'Skeleton' }, '@/lib/utils': { cn: (...args) => args.join(' ') },
    })
    const select = ArenaSelector({ isCollapsed }).props.children
    assert.equal(select.type, 'Select')
    select.props.onValueChange('unknown')
    select.props.onValueChange('arena-a')
    assert.equal(routes.length, 0)
    select.props.onValueChange('arena-b')
    assert.deepEqual(selected, ['arena-b'])
    assert.deepEqual(routes, ['/dashboard'])
  })
}
