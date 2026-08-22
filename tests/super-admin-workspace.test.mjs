import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('admin navigation exposes the complete information architecture without arena impersonation', async () => {
  const [sections, shell] = await Promise.all([
    source('src/modules/super-admin/sections.ts'),
    source('src/modules/super-admin/components/SuperAdminShell.tsx'),
  ])

  for (const section of ['overview', 'arenas', 'imports', 'finance', 'athletes', 'users', 'engagement', 'settings']) {
    assert.match(sections, new RegExp(`"${section}"`, 'u'))
  }
  assert.match(shell, /label: "Operação"/u)
  assert.match(shell, /label: "Negócio"/u)
  assert.match(shell, /href: "\/admin\/imports"/u)
  assert.match(shell, /href: "\/admin\/users"/u)
  assert.match(shell, /aria-current=\{active \? "page" : undefined\}/u)
  assert.doesNotMatch(shell, /href="\/dashboard"/u)
})

test('workspace routes each area to a dedicated section component', async () => {
  const workspace = await source('src/modules/super-admin/components/SuperAdminWorkspace.tsx')

  for (const [section, component] of [
    ['arenas', 'ArenasSection'],
    ['imports', 'ImportsSection'],
    ['finance', 'FinanceSection'],
    ['athletes', 'AthletesSection'],
    ['users', 'UsersSection'],
    ['engagement', 'EngagementSection'],
    ['settings', 'SettingsSection'],
  ]) {
    assert.match(workspace, new RegExp(`section === "${section}"[^\n]+<${component}`, 'u'))
  }
})

test('public arena import has a visible operational plan, reviewed discovery and batch history', async () => {
  const imports = await source('src/modules/super-admin/components/sections/ImportsSection.tsx')

  assert.match(imports, /PublicArenaImportDialog/u)
  assert.match(imports, /listPublicArenaImportBatchesAction\(12\)/u)
  assert.match(imports, /Descobrir/u)
  assert.match(imports, /Qualificar/u)
  assert.match(imports, /Deduplicar/u)
  assert.match(imports, /Publicar/u)
  assert.match(imports, /OpenStreetMap/u)
  assert.match(imports, /criando rascunhos, nunca publicação automática/u)
})

test('users owns platform access while settings remains focused on global operations', async () => {
  const [users, settings] = await Promise.all([
    source('src/modules/super-admin/components/sections/UsersSection.tsx'),
    source('src/modules/super-admin/components/sections/SettingsSection.tsx'),
  ])

  assert.match(users, /managePlatformPrincipalAction/u)
  assert.match(users, /Não concede acesso a nenhuma arena de cliente/u)
  assert.match(settings, /Pix e split/u)
  assert.match(settings, /Planos internos/u)
  assert.match(settings, /Auditoria/u)
  assert.doesNotMatch(settings, /managePlatformPrincipalAction/u)
})
