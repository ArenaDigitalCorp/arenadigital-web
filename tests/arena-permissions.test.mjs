import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import {
  canAccessArenaBackoffice,
  canManageArena,
  canManageArenaSubscription,
} from '../src/lib/arena-permissions.ts'

const subjects = {
  owner: { isOwner: true, role: 'Owner' },
  manager: { isOwner: false, role: 'Gestor' },
  attendant: { isOwner: false, role: 'Atendente' },
  cashier: { isOwner: false, role: 'Caixa' },
}

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

test('arena capability matrix keeps management and ownership boundaries explicit', () => {
  assert.equal(canManageArena(subjects.owner), true)
  assert.equal(canManageArena(subjects.manager), true)
  assert.equal(canManageArena(subjects.attendant), false)
  assert.equal(canManageArena(subjects.cashier), false)

  assert.equal(canAccessArenaBackoffice(subjects.attendant), true)
  assert.equal(canAccessArenaBackoffice(subjects.cashier), false)

  assert.equal(canManageArenaSubscription(subjects.owner), true)
  assert.equal(canManageArenaSubscription(subjects.manager), true)
})

test('platform administrators stay isolated from customer arena operations', async () => {
  const serverAuth = await source('src/lib/server-auth.ts')
  assert.match(serverAuth, /Platform administrators cannot access customer arena backoffices/)
  assert.doesNotMatch(serverAuth, /role: 'PlatformAdmin'/)
  assert.match(serverAuth, /if \(!access\.isOwner\)/)

  const arenasApi = await source('src/app/api/arenas/route.ts')
  assert.doesNotMatch(arenasApi, /platformArenasResult/)
  assert.doesNotMatch(arenasApi, /role: 'PlatformAdmin'/)

  const adminArenaPage = await source('src/app/admin/arenas/[id]/page.tsx')
  assert.doesNotMatch(adminArenaPage, /\/dashboard\/arenas\/\$\{arena\.id\}/)
})

test('admin-only screens use the same server guard as their mutations', async () => {
  const pages = [
    'src/app/dashboard/arenas/[id]/spaces/new/page.tsx',
    'src/app/dashboard/arenas/[id]/spaces/[spaceId]/edit/page.tsx',
    'src/app/dashboard/finance/[arenaId]/page.tsx',
    'src/app/dashboard/reports/[arenaId]/clientes-overview/page.tsx',
    'src/app/dashboard/reports/[arenaId]/status-pagamentos/page.tsx',
    'src/app/dashboard/settings/products/[id]/page.tsx',
    'src/app/dashboard/settings/users/[arenaId]/page.tsx',
  ]

  for (const page of pages) {
    assert.match(await source(page), /assertArenaAdminAccess\(/, `${page} must be admin-only`)
  }

  const arenaClient = await source('src/modules/arenas/components/ArenaDetailPageClient.tsx')
  assert.match(arenaClient, /canManage && activeTab === 'espacos'/)
  assert.match(arenaClient, /canManage && activeTab === 'cadastro'/)

  const stationsClient = await source('src/modules/stations/components/StationsPageClient.tsx')
  assert.match(stationsClient, /actions=\{canManage \?/)
})
