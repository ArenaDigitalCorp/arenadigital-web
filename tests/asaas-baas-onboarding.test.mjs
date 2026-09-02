import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  createArenaAsaasSubaccountSchema,
  isValidCnpj,
  isValidCpf,
  normalizeAsaasSubaccountInput,
} from '../src/modules/arenas/schemas/asaas-baas.schema.ts'

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const validInput = {
  name: 'Arena Centro Esportivo Ltda',
  email: 'financeiro@arena.example',
  cpfCnpj: '11.222.333/0001-81',
  companyType: 'LIMITED',
  mobilePhone: '(48) 99999-1234',
  incomeValue: 50000,
  address: 'Rua das Quadras',
  addressNumber: '120',
  complement: 'Sala 2',
  province: 'Centro',
  postalCode: '88000-123',
}

test('Asaas BaaS onboarding validates Brazilian documents and normalizes registration fields', () => {
  assert.equal(isValidCpf('529.982.247-25'), true)
  assert.equal(isValidCpf('111.111.111-11'), false)
  assert.equal(isValidCnpj(validInput.cpfCnpj), true)
  assert.equal(isValidCnpj('11.111.111/1111-11'), false)

  const parsed = createArenaAsaasSubaccountSchema.parse(validInput)
  assert.deepEqual(normalizeAsaasSubaccountInput(parsed), {
    ...validInput,
    cpfCnpj: '11222333000181',
    mobilePhone: '48999991234',
    postalCode: '88000123',
  })
  assert.equal(createArenaAsaasSubaccountSchema.safeParse({ ...validInput, incomeValue: 0 }).success, false)
  assert.equal(createArenaAsaasSubaccountSchema.safeParse({ ...validInput, cpfCnpj: '529.982.247-25' }).success, false)
  assert.equal(createArenaAsaasSubaccountSchema.safeParse({ ...validInput, unexpected: true }).success, false)
})

test('new subaccounts use an exclusive webhook token and persist only its hash', async () => {
  const [service, actions] = await Promise.all([
    source('src/modules/arenas/services/asaas-baas.service.ts'),
    source('src/modules/arenas/actions/arenaActions.ts'),
  ])

  assert.match(service, /import 'server-only'/u)
  assert.match(service, /ASAAS_BOOKING_WEBHOOK_URL/u)
  assert.match(service, /NEXT_PUBLIC_SUPABASE_URL/u)
  assert.match(service, /\/functions\/v1\/asaas-booking-webhook/u)
  assert.match(service, /ASAAS_ENV deve ser configurado explicitamente/u)
  assert.doesNotMatch(service, /ASAAS_WEBHOOK_TOKEN/u)
  assert.match(actions, /randomBytes\(32\)\.toString\('base64url'\)/u)
  assert.match(actions, /createHash\('sha256'\)\.update\(webhookToken\)\.digest\('hex'\)/u)
  assert.match(actions, /webhook_token_hash:\s*webhookTokenHash/u)

  const provisioningMarker = actions.indexOf('const provisioningStartedAt')
  const remoteCreation = actions.indexOf('subaccount = await createAsaasSubaccount')
  const recoveryEnvelope = actions.indexOf('await storeCredentialRecoveryEnvelope(recoveryPayload)')
  const recoveryBaseline = actions.indexOf('const recoveryBaseline = await updateArenaPaymentAccount')
  const credentialStore = actions.indexOf('await storeSubaccountCredentials', remoteCreation)
  const accountBaseline = actions.indexOf('const baseline = await saveArenaPaymentAccount')
  assert.ok(
    provisioningMarker >= 0 &&
      remoteCreation > provisioningMarker &&
      recoveryEnvelope > remoteCreation &&
      recoveryBaseline > recoveryEnvelope &&
      credentialStore > recoveryBaseline &&
      accountBaseline > credentialStore,
    'provisioning and encrypted recovery must be durable before the returned credential is vaulted',
  )
  assert.match(actions, /createCipheriv\('aes-256-gcm'/u)
  assert.match(actions, /store_arena_asaas_credential_recovery/u)
  assert.doesNotMatch(actions, /asaasCredentialRecovery:/u)
  assert.match(actions, /recoverArenaAsaasSubaccountCredentialAction/u)
  assert.match(service, /recoverAsaasSubaccountCredential/u)
  assert.match(service, /\/v3\/accounts\?cpfCnpj=/u)
  assert.match(service, /\/accessTokens/u)
  assert.match(actions, /Boolean\(existing\.asaas_account_id\)/u)
  assert.match(actions, /claim_arena_asaas_subaccount_provisioning/u)
  assert.match(actions, /release_arena_asaas_subaccount_provisioning/u)
  assert.match(actions, /error\.status === 401/u)
  assert.match(actions, /\[400, 422\]\.includes\(error\.status\)/u)
  assert.match(actions, /asaas_recovery_found_no_account/u)
})

test('status sync uses subaccount runtime credentials and approval guards activation', async () => {
  const [service, actions] = await Promise.all([
    source('src/modules/arenas/services/asaas-baas.service.ts'),
    source('src/modules/arenas/actions/arenaActions.ts'),
  ])
  const syncBody = actions.slice(
    actions.indexOf('async function syncArenaAsaasSubaccount'),
    actions.indexOf('function arenaPaymentAccountsTable'),
  )

  assert.match(service, /get_arena_asaas_runtime_credentials/u)
  assert.match(service, /'\/v3\/myAccount\/status'/u)
  assert.match(service, /'\/v3\/myAccount\/documents'/u)
  assert.match(syncBody, /snapshot\.status\.general === 'APPROVED'[\s\S]*Boolean\(existing\.webhook_token_hash\)[\s\S]*Boolean\(existing\.asaas_account_id\)[\s\S]*Boolean\(existing\.asaas_wallet_id\)/u)
  assert.match(syncBody, /apply_arena_asaas_manual_status_snapshot/u)
  assert.match(syncBody, /p_snapshot_observed_at: snapshotObservedAt/u)
  assert.match(syncBody, /existing\.activated_at === null[\s\S]*updated\.activated_at !== null[\s\S]*updated\.status === 'active'/u)
  assert.doesNotMatch(syncBody, /updateArenaPaymentAccount\(/u)
  assert.match(actions, /activated_at:\s*parsed\.enabled/u)
  assert.match(actions, /Date\.parse\(existing\.updated_at\) \+ 15_000/u)
  assert.match(actions, /assertArenaAsaasRuntimeCredentials\(arenaId\)/u)
  assert.match(actions, /O split só pode ser ativado depois da aprovação geral/u)
})

test('admin payloads never select or render the protected API key', async () => {
  const [platformActions, component] = await Promise.all([
    source('src/modules/platform-admin/actions/platformAdminActions.ts'),
    source('src/modules/arenas/components/ArenaPixSplitSettingsCard.tsx'),
  ])

  assert.doesNotMatch(platformActions, /asaas_api_key_secret_id/u)
  assert.doesNotMatch(component, /apiKey|api_key|ASAAS_API_KEY/u)
  assert.match(component, /settings\.onboardingStarted/u)
  assert.match(component, /settings\.paymentFlow === "arena_subaccount_split"/u)
})
