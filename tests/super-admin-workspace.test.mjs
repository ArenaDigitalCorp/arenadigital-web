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
  assert.match(shell, /canReturnToOwnedArena &&/u)
  assert.match(shell, /href="\/dashboard"/u)
  assert.doesNotMatch(shell, /\/dashboard\/arenas\//u)
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

test('public arena import keeps one primary action and progressively separates batches from campaigns', async () => {
  const [imports, importSchema] = await Promise.all([
    source('src/modules/super-admin/components/sections/ImportsSection.tsx'),
    source('src/modules/platform-admin/schemas/public-arena-import.schema.ts'),
  ])

  const primaryImportActions = imports.match(
    /<PublicArenaImportDialog onBatchChange=\{refreshBatch\} \/>/gu,
  ) ?? []

  assert.equal(primaryImportActions.length, 1)
  assert.doesNotMatch(imports, /PublicArenaListingDialog/u)
  assert.match(imports, /const BATCH_HISTORY_LIMIT = 100/u)
  assert.match(imports, /listPublicArenaImportBatchesAction\(BATCH_HISTORY_LIMIT\)/u)
  assert.match(importSchema, /listPublicArenaImportBatchesInputSchema = z\.number\(\)\.int\(\)\.min\(1\)\.max\(100\)/u)
  assert.match(imports, /setBatches\(result\.batches\)/u)
  assert.match(imports, /Mostrar mais lotes/u)
  assert.match(imports, /<Tabs defaultValue="batches"/u)
  assert.match(imports, /<TabsTrigger value="batches"[\s\S]*?>[\s\S]*?Lotes/u)
  assert.match(imports, /<TabsTrigger value="campaigns"[\s\S]*?>Campanhas<\/TabsTrigger>/u)
  assert.match(imports, /<PublicArenaImportCampaigns onBatchesChange=\{loadBatches\} \/>/u)
  assert.match(imports, /batchId=\{batch\.id\}/u)
  assert.match(imports, /<details[^>]*>[\s\S]*?<summary[^>]*>[\s\S]*?Como funciona a importação\?/u)
  assert.match(imports, /Importar não publica\./u)
  assert.match(imports, /As arenas entram ocultas e sem cliente, assinatura ou quadra\./u)
  assert.match(imports, /A publicação no app continua sendo uma decisão separada na tela da arena\./u)
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
