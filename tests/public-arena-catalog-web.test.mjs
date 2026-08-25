import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { getArenaCommercialStatus } from '../src/modules/platform-admin/lib/commercial-status.ts'
import {
  parsePublicArenaCsv,
  publicArenaImportCsvTemplate,
} from '../src/modules/platform-admin/lib/public-arena-import.ts'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const customer = {
  platformKind: 'customer',
  arenaStatus: 'ativo',
  subscriptionStatus: null,
  currentPeriodEnd: null,
  isInternalPlan: false,
  now: Date.parse('2026-08-16T12:00:00Z'),
}

test('public listings and demos never contaminate the commercial prospect funnel', () => {
  assert.equal(
    getArenaCommercialStatus({ ...customer, platformKind: 'public_listing' }),
    'catalogo_publico',
  )
  assert.equal(
    getArenaCommercialStatus({ ...customer, platformKind: 'demo' }),
    'demonstracao',
  )
  assert.equal(getArenaCommercialStatus(customer), 'prospect')
})

test('customer commercial states preserve subscriptions, delinquency and deactivation rules', () => {
  assert.equal(
    getArenaCommercialStatus({ ...customer, subscriptionStatus: 'active', currentPeriodEnd: '2026-09-01T00:00:00Z' }),
    'cliente_ativo',
  )
  assert.equal(
    getArenaCommercialStatus({ ...customer, subscriptionStatus: 'active', currentPeriodEnd: '2026-08-01T00:00:00Z' }),
    'inadimplente',
  )
  assert.equal(getArenaCommercialStatus({ ...customer, subscriptionStatus: 'past_due' }), 'inadimplente')
  assert.equal(getArenaCommercialStatus({ ...customer, arenaStatus: 'inativo' }), 'desativada')
})

test('public listing creation is superadmin-only and delegates ownership rules to the dedicated RPC', async () => {
  const actions = await source('src/modules/platform-admin/actions/platformAdminActions.ts')
  const creationAction = actions.slice(
    actions.indexOf('export async function createPublicArenaListingAction'),
    actions.indexOf('function revalidatePublicArenaCatalogPaths'),
  )

  assert.match(creationAction, /export async function createPublicArenaListingAction/u)
  assert.match(creationAction, /const profile = await assertPlatformSuperAdminAccess\(\)/u)
  assert.match(creationAction, /publicArenaListingInputSchema\.parse\(input\)/u)
  assert.match(creationAction, /rpc\('create_public_arena_listing'/u)
  assert.match(creationAction, /p_source: 'manual'/u)
  assert.match(creationAction, /p_external_id: null/u)
  assert.match(creationAction, /p_location_wkt: location\.wkt/u)
  assert.match(creationAction, /location_precision: location\.precision/u)
  assert.match(creationAction, /operation: 'create_public_arena_listing'/u)
  assert.doesNotMatch(creationAction, /observer\.complete\([\s\S]*?(cnpj|phone|email|address):/u)
})

test('public listing schema enforces location, sport, document and audit validation', async () => {
  const schema = await source('src/modules/platform-admin/schemas/public-arena-listing.schema.ts')

  assert.match(schema, /name: z\.string\(\)\.trim\(\)\.min\(2/u)
  assert.match(schema, /address: z\.string\(\)\.trim\(\)\.min\(2/u)
  assert.match(schema, /isValidCnpj\(value\)/u)
  assert.match(schema, /value\.length === 0 \|\| value\.length === 8/u)
  assert.match(schema, /sportIds: z\.array\(z\.string\(\)\.uuid\(\)\)\.min\(1/u)
  assert.match(schema, /reason: z\.string\(\)\.trim\(\)\.min\(8/u)
  assert.match(schema, /\.strict\(\)/u)
})

test('admin dialog communicates hidden non-customer creation and supports optional CNPJ enrichment', async () => {
  const dialog = await source('src/modules/platform-admin/components/PublicArenaListingDialog.tsx')

  assert.match(dialog, /Adicionar local público/u)
  assert.match(dialog, /O local nasce oculto no aplicativo/u)
  assert.match(dialog, /não cria cliente, proprietário, assinatura, quadras ou acesso ao backoffice/u)
  assert.match(dialog, /\/api\/lookup-cnpj\?cnpj=/u)
  assert.match(dialog, /getPublicArenaMunicipalitiesAction/u)
  assert.match(dialog, /Criar local oculto/u)
})

test('CSV import preserves quoted fields and produces a strict reusable template', () => {
  const headers = publicArenaImportCsvTemplate().trim()
  const row = [
    'osm:way/42',
    '"Arena, Centro"',
    '',
    '"Rua Um, 10"',
    '',
    '',
    '',
    '',
    '',
    '',
    '"Linha um\nLinha dois"',
    '4205407',
    '11111111-1111-4111-8111-111111111111|22222222-2222-4222-8222-222222222222',
    '-27.59',
    '-48.55',
    '',
  ].join(',')

  const [parsed] = parsePublicArenaCsv(`${headers}\n${row}\n`)
  assert.equal(parsed.item.name, 'Arena, Centro')
  assert.equal(parsed.item.address, 'Rua Um, 10')
  assert.equal(parsed.item.description, 'Linha um\nLinha dois')
  assert.equal(parsed.item.municipality_id, 4205407)
  assert.equal(parsed.item.sport_ids.length, 2)
  assert.deepEqual(parsed.errors, [])
})

test('reviewed imports are superadmin-only, idempotent RPC-backed and hidden by default', async () => {
  const [actions, dialog] = await Promise.all([
    source('src/modules/platform-admin/actions/platformAdminActions.ts'),
    source('src/modules/platform-admin/components/PublicArenaImportDialog.tsx'),
  ])

  for (const action of [
    'stagePublicArenaImportBatchAction',
    'applyPublicArenaImportBatchAction',
    'discoverOpenStreetMapArenasAction',
  ]) {
    const start = actions.indexOf(`export async function ${action}`)
    assert.notEqual(start, -1)
    assert.match(actions.slice(start, start + 2_500), /assertPlatformSuperAdminAccess\(\)/u)
  }
  assert.match(actions, /rpc\('stage_public_arena_import_batch'/u)
  assert.match(actions, /p_operation_id: parsed\.operationId/u)
  assert.match(actions, /rpc\('apply_public_arena_import_batch'/u)
  assert.match(actions, /IBGE:GEOCODIGO/u)
  assert.match(dialog, /As arenas serão adicionadas/u)
  assert.match(dialog, /ocultas<\/strong>, sem cliente, assinatura ou quadra/u)
  assert.match(dialog, /Dados © OpenStreetMap contributors \(ODbL\)/u)
})

test('customer claim keeps the arena identity and delegates ownership to the audited RPC', async () => {
  const [actions, card] = await Promise.all([
    source('src/modules/platform-admin/actions/platformAdminActions.ts'),
    source('src/modules/platform-admin/components/PublicArenaCustomerClaimCard.tsx'),
  ])
  const start = actions.indexOf('export async function claimPublicArenaAsCustomerAction')
  const claimAction = actions.slice(start, actions.indexOf('export async function searchEligibleArenaOwnersAction'))

  assert.match(claimAction, /assertPlatformSuperAdminAccess\(\)/u)
  assert.match(claimAction, /rpc\('claim_public_arena_as_customer'/u)
  assert.match(claimAction, /p_arena_id: parsed\.arenaId/u)
  assert.doesNotMatch(claimAction, /from\('arenas'\)\.(insert|update)/u)
  assert.match(card, /sem trocar o arena_id/u)
  assert.match(card, /Não cria assinatura, quadra, agenda, Pix ou split/u)
})
