import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import * as permissions from '../src/lib/arena-permissions.ts'

function load(path, imports) {
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const loadedModule = { exports: {} }
  vm.runInNewContext(code, { module: loadedModule, exports: loadedModule.exports, console, require(name) {
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }) }
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`)
    return imports[name]
  } })
  return loadedModule.exports
}

function harness({ level = 'super_admin', owns = true, status = 'Ativo', role = 'Gestor', linked = true } = {}) {
  const userId = 'test-user'
  const arenaRows = [
    { id: 'arena-owned', name: 'Arena A', owner_id: owns ? userId : 'other-user' },
    { id: 'arena-linked', name: 'Arena B', owner_id: 'other-user' },
    { id: 'arena-foreign', name: 'Arena C', owner_id: 'other-user' },
  ]
  const membershipRows = linked ? [{ id: 'link-test', arena_id: 'arena-linked', user_id: userId,
    status, role, station_id: 'station-test', arenas: { id: 'arena-linked', name: 'Arena B' } }] : []
  const supabase = {
    async rpc() { return { data: level, error: null } },
    from(table) {
      let rows = table === 'arenas' ? arenaRows : table === 'arena_users' ? membershipRows : []
      return {
        select() { return this },
        eq(column, value) { rows = rows.filter(row => row[column] === value); return this },
        in(column, values) { rows = rows.filter(row => values.includes(row[column])); return this },
        order() { return this },
        limit(size) { rows = rows.slice(0, size); return this },
        async maybeSingle() { return { data: rows[0] ?? null, error: null } },
        then(resolve, reject) { return Promise.resolve({ data: rows, error: null }).then(resolve, reject) },
      }
    },
  }
  const memberships = load('src/lib/arena-users.ts', {})
  const auth = load('src/lib/server-auth.ts', {
    '@/lib/supabase/server': { createSupabaseServerClient: async () => ({ auth: {
      getUser: async () => ({ data: { user: { id: 'auth-test' } }, error: null }),
    } }) },
    '@/lib/arena-users': memberships,
    '@/lib/supabase-server': { getSupabaseAdmin: () => supabase },
    '@/lib/account-identity': { resolveAuthenticatedDbUser: async () => ({ id: userId }) },
    '@/lib/arena-permissions': permissions,
  })
  const route = load('src/app/api/arenas/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    '@/lib/arena-users': memberships,
    '@/lib/server-auth': auth,
    '@/lib/supabase-server': { getSupabaseAdmin: () => supabase },
  })
  return { auth, route }
}

test('super admin sees own and explicitly linked arenas, never all platform arenas', async () => {
  const { auth, route } = harness()
  const response = await route.GET()
  assert.equal(response.status, 200)
  assert.deepEqual(Array.from(response.body, arena => arena.id), ['arena-owned', 'arena-linked'])
  const manager = await auth.assertArenaAdminAccess('arena-linked')
  assert.equal(manager.role, 'Gestor')
  assert.equal(manager.isOwner, false)
  assert.equal(manager.isPlatformAdmin, false)
  assert.equal(manager.arenaUserId, 'link-test')
  await assert.rejects(auth.assertArenaAccess('arena-foreign'), { status: 403 })
  await assert.rejects(auth.assertArenaOwnerAccess('arena-linked'), { status: 403 })
})

for (const options of [{ status: 'Inativo' }, { linked: false }, { role: 'Atleta' }]) {
  test(`super admin cannot access non-owned arena without a valid active backoffice link: ${JSON.stringify(options)}`, async () => {
    const { auth, route } = harness({ owns: false, ...options })
    assert.equal((await route.GET()).body.length, 0)
    assert.equal(await auth.hasExplicitArenaAccess('test-user'), false)
    await assert.rejects(auth.assertArenaAccess('arena-linked'), { status: 403 })
  })
}

test('membership alone allows dashboard entry; platform identity alone does not', async () => {
  assert.equal(await harness({ owns: false }).auth.hasExplicitArenaAccess('test-user'), true)
  assert.equal(await harness({ owns: false, linked: false }).auth.hasExplicitArenaAccess('test-user'), false)
})

for (const linked of [true, false]) {
  test(`dashboard and admin return navigation agree for super admin without ownership (linked=${linked})`, async () => {
    const { auth } = harness({ owns: false, linked })
    const imports = {
      '@/lib/server-auth': auth,
      'next/navigation': { redirect(path) { throw new Error(`Redirect:${path}`) } },
      '@/components/dashboard/DashboardLayoutWrapper': { DashboardLayoutWrapper: 'Dashboard' },
      '@/modules/super-admin/components/SuperAdminShell': { SuperAdminShell: 'Admin' },
    }
    const { default: dashboard } = load('src/app/dashboard/layout.tsx', imports)
    const { default: admin } = load('src/app/admin/layout.tsx', imports)
    auth.assertPlatformSuperAdminAccess = async () => ({ dbUserId: 'test-user' })
    if (linked) assert.equal((await dashboard({ children: null })).type, 'Dashboard')
    else await assert.rejects(dashboard({ children: null }), /Redirect:\/admin\/overview/)
    assert.equal((await admin({ children: null })).props.canReturnToArena, linked)
  })
}

for (const role of ['Atendente', 'Caixa']) {
  test(`super admin retains the ${role} membership restrictions`, async () => {
    const { auth } = harness({ role })
    const profile = await auth.assertArenaAccess('arena-linked')
    assert.equal(profile.role, role)
    assert.equal(profile.assignedStationId, 'station-test')
    await assert.rejects(auth.assertArenaAdminAccess('arena-linked'), { status: 403 })
    await assert.rejects(auth.assertArenaOwnerAccess('arena-linked'), { status: 403 })
    if (role === 'Caixa') await assert.rejects(auth.assertArenaBackofficeAccess('arena-linked'), { status: 403 })
  })
}

test('platform admin remains isolated even with ownership or membership', async () => {
  const { auth, route } = harness({ level: 'platform_admin' })
  assert.equal((await route.GET()).body.length, 0)
  await assert.rejects(auth.assertArenaAccess('arena-linked'), { status: 403 })
  await assert.rejects(auth.assertArenaAccess('arena-owned'), { status: 403 })
})

test('ordinary manager keeps existing membership and cross-arena boundaries', async () => {
  const { auth, route } = harness({ level: null, owns: false })
  assert.deepEqual(Array.from((await route.GET()).body, arena => arena.id), ['arena-linked'])
  assert.equal((await auth.assertArenaAdminAccess('arena-linked')).role, 'Gestor')
  await assert.rejects(auth.assertArenaAccess('arena-foreign'), { status: 403 })
})
