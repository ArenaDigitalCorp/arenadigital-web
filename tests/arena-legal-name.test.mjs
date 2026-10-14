import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadTypescriptModule, realReact as React } from './helpers/load-typescript-module.mjs'

const { arenaSchema } = loadTypescriptModule('src/modules/arenas/schemas/arena.schema.ts')
const { publicArenaListingInputSchema } = loadTypescriptModule('src/modules/platform-admin/schemas/public-arena-listing.schema.ts')
const { createArenaSignupIntent, readArenaSignupIntent, ARENA_SIGNUP_INTENT_KEY } = loadTypescriptModule('src/modules/auth/lib/arena-signup-intent.ts')
const cnpj = '26.472.629/0001-28'
const arena = { name: 'Arena Beach', status: 'ativo', address: 'Rua Vera Linhares', id_municipio: 4205407, cpf_cnpj: cnpj }

test('company registration requires a legal name, trims it, and preserves the display name', () => {
  for (const legal_name of [undefined, null, '', '   ', 'A', 'A'.repeat(121)]) {
    const result = arenaSchema.safeParse({ ...arena, legal_name })
    assert.equal(result.success, false)
    assert.equal(result.error.issues[0].path[0], 'legal_name')
  }
  const parsed = arenaSchema.parse({ ...arena, legal_name: '  Arena Beach Esportes de Areia Ltda  ' })
  assert.equal(parsed.name, 'Arena Beach')
  assert.equal(parsed.legal_name, 'Arena Beach Esportes de Areia Ltda')
})

test('CPF and undocumented locations do not require a company legal name', () => {
  for (const cpf_cnpj of ['52998224725', '', null, undefined]) {
    assert.equal(arenaSchema.safeParse({ ...arena, cpf_cnpj }).success, true)
  }
})

test('administrative public listing applies the same company rule', () => {
  const input = { name: 'Local Beach', cnpj, address: 'Rua Vera Linhares', stateCode: 42, municipalityId: 4205407,
    sportIds: ['f97a5110-f96f-4686-966f-6908033251b3'], reason: 'Cadastrar local de teste' }
  assert.equal(publicArenaListingInputSchema.safeParse(input).success, false)
  assert.equal(publicArenaListingInputSchema.parse({ ...input, legalName: ' Empresa Ltda ' }).legalName, 'Empresa Ltda')
  assert.equal(publicArenaListingInputSchema.safeParse({ ...input, cnpj: '' }).success, true)
})

test('legal name survives confirmation metadata and old signup intents stay readable', () => {
  const input = { arenaName: 'Arena Beach', arenaDocument: cnpj, arenaLegalName: ' Empresa Ltda ', phone: '48999999999', cpf: '52998224725', addressData: { id_municipio: 4205407 } }
  const intent = createArenaSignupIntent(input)
  assert.equal(readArenaSignupIntent({ [ARENA_SIGNUP_INTENT_KEY]: intent }).arenaLegalName, 'Empresa Ltda')
  delete intent.arenaLegalName
  assert.equal(readArenaSignupIntent({ [ARENA_SIGNUP_INTENT_KEY]: intent }).arenaLegalName, undefined)
  assert.equal(readArenaSignupIntent({ [ARENA_SIGNUP_INTENT_KEY]: { ...intent, arenaLegalName: 123 } }), null)
})

test('signup rejects a company without legal name before creating any account', async () => {
  let accounts = 0
  const { startSignUpAction } = loadTypescriptModule('src/modules/auth/actions/authActions.ts', {
    '@/lib/supabase/server': { createSupabaseServerClient: async () => { accounts++; throw new Error('Unexpected account creation') } },
    '@/lib/supabase-server': {}, '@/lib/account-identity': { normalizeEmail: value => value.trim().toLowerCase() },
    '@/lib/server-auth': {}, '@/modules/users/services/resolve-self-service-arena-signup': {},
    '@/lib/observability/server': { observeServerAction: async () => ({ complete() {}, log() {} }) },
    'next/headers': {},
  })
  const result = await startSignUpAction({ email: 'owner@example.invalid', password: 'Arena2026!', firstName: 'Teste', lastName: 'Gestor',
    cpf: '52998224725', phone: '48999999999', arenaName: 'Arena Beach', arenaDocument: cnpj, addressData: { id_municipio: 4205407 } })
  assert.equal(result.success, false)
  assert.equal(result.error, 'Informe a razão social da empresa.')
  assert.equal(accounts, 0)
})

test('finance prefill uses legal name and never substitutes the trade name', () => {
  const { ArenaPixSplitSettingsCard } = loadTypescriptModule('src/modules/arenas/components/ArenaPixSplitSettingsCard.tsx', {
    '@/modules/arenas/actions/arenaActions': {},
  })
  const render = (legalName, holderName = '') => renderToStaticMarkup(React.createElement(ArenaPixSplitSettingsCard, {
    arenaId: '11111111-1111-4111-8111-111111111111', arenaName: 'Nome Fantasia',
    initialSettings: { onboardingStarted: false, holderName, holderDocument: '', onboardingStatus: 'NOT_STARTED' },
    registration: { legalName, email: '', phone: '', document: '', address: '', addressNumber: '', complement: '', province: '', postalCode: '' },
    accessMode: 'arena',
  }))
  assert.match(render('Empresa Ltda', 'Titular antigo'), /id="baas-name"[^>]*value="Empresa Ltda"/)
  assert.match(render(undefined, 'Titular antigo'), /id="baas-name"[^>]*value="Titular antigo"/)
  assert.match(render(undefined), /id="baas-name"[^>]*value=""/)
})

test('partial edits cannot erase a company legal name or introduce CNPJ without one', async () => {
  const writes = []
  let current = { cpf_cnpj: cnpj, legal_name: 'Empresa Ltda' }
  const client = { from: table => {
    assert.equal(table, 'arenas')
    let payload
    const query = { select: () => query, eq: () => query,
      update(value) { payload = value; writes.push(value); return query },
      single: async () => ({ data: payload ? { id: 'arena-test', ...current, ...payload } : current, error: null }) }
    return query
  } }
  const { updateArenaAction } = loadTypescriptModule('src/modules/arenas/actions/arenaActions.ts', {
    'server-only': {}, 'next/cache': { revalidatePath() {} },
    '@/lib/supabase-server': { getSupabaseAdmin: () => client },
    '@/lib/server-auth': { assertArenaAdminAccess: async () => ({ dbUserId: 'manager-test' }) },
    '@/modules/arenas/services/asaas-baas.service': {},
  })
  assert.equal((await updateArenaAction('arena-test', { legal_name: null })).success, false)
  assert.equal(writes.length, 0)
  current = { cpf_cnpj: '52998224725', legal_name: null }
  assert.equal((await updateArenaAction('arena-test', { cpf_cnpj: cnpj })).success, false)
  assert.equal(writes.length, 0)
  current = { cpf_cnpj: cnpj, legal_name: null }
  assert.equal((await updateArenaAction('arena-test', { app_booking_mode: 'disabled' })).success, true)
  assert.equal(writes.length, 1, 'Operational updates remain available for legacy companies')
  assert.equal((await updateArenaAction('arena-test', { legal_name: '  Empresa Ltda  ' })).success, true)
  assert.equal(writes[1].legal_name, 'Empresa Ltda')
})
