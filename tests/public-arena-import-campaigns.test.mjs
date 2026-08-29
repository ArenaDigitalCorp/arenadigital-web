import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('campaign actions remain behind superadmin and the service worker boundary', async () => {
  const actions = await source('src/modules/platform-admin/actions/platformAdminActions.ts')
  const createStart = actions.indexOf('export async function createPublicArenaImportCampaignAction')
  const listStart = actions.indexOf('export async function listPublicArenaImportCampaignsAction', createStart)
  const createAction = actions.slice(createStart, listStart)
  const workerStart = actions.indexOf('export async function runPublicArenaImportWorkerAction')
  const workerAction = actions.slice(workerStart, actions.indexOf('export async function applyPublicArenaImportBatchAction', workerStart))

  assert.match(createAction, /assertPlatformSuperAdminAccess\(\)/)
  assert.match(createAction, /rpc\('create_public_arena_import_campaign'/)
  assert.match(workerAction, /assertPlatformSuperAdminAccess\(\)/)
  assert.match(workerAction, /functions\.invoke\('public-arena-import-worker'/)
})

test('campaign UI keeps automatic discovery review-first and bounded', async () => {
  const component = await source('src/modules/platform-admin/components/PublicArenaImportCampaigns.tsx')

  assert.match(component, /no máximo 100 municípios/)
  assert.match(component, /maxAttempts: 3/)
  assert.match(component, /maxResultsPerMunicipality: 150/)
  assert.match(component, /startImmediately: true/)
  assert.match(component, /window\.setInterval\(\(\) => void runCycle\(true\), 35_000\)/)
  assert.match(component, /nunca publica arenas automaticamente/)
  assert.match(component, /if \(result\.staged > 0\) await onBatchesChange\?\.\(\)/)
  assert.doesNotMatch(component, /applyPublicArenaImportBatchAction/)
})

test('campaign creation is progressive and operational list states stay explicit', async () => {
  const component = await source('src/modules/platform-admin/components/PublicArenaImportCampaigns.tsx')

  assert.match(component, /<DialogTrigger asChild>/)
  assert.match(component, /Nova campanha/)
  assert.match(component, /<DialogContent/)
  assert.match(component, /setCycleRunning\(true\)/)
  assert.match(component, /cycleRunning \? "Processando…" : "Processar próximo"/)
  assert.match(component, /campaignsError && campaigns\.length === 0/)
  assert.match(component, /Não foi possível carregar as campanhas/)
  assert.match(component, /Nenhuma campanha criada/)
})

test('campaign payload normalization does not expose private source identifiers', async () => {
  const normalizer = await source('src/modules/platform-admin/lib/public-arena-import-campaign-result.ts')

  assert.match(normalizer, /lastErrorCode: nullableString\(job\.last_error_code\)/)
  assert.match(normalizer, /source: 'openstreetmap'/)
  assert.doesNotMatch(normalizer, /external_id|externalId/)
})
