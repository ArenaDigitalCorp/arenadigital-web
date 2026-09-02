import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

test('subaccount webhook registers account-status events together with payment events', async () => {
  const service = await source('src/modules/arenas/services/asaas-baas.service.ts')

  for (const event of [
    'ACCOUNT_STATUS_BANK_ACCOUNT_INFO_APPROVED',
    'ACCOUNT_STATUS_COMMERCIAL_INFO_PENDING',
    'ACCOUNT_STATUS_DOCUMENT_REJECTED',
    'ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED',
    'ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED',
    'ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRING_SOON',
    'ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRED',
  ]) {
    assert.match(service, new RegExp(`'${event}'`, 'u'))
  }
})

test('approved provider snapshot activates receiving only after every local safety gate', async () => {
  const actions = await source('src/modules/arenas/actions/arenaActions.ts')
  const syncBody = actions.slice(
    actions.indexOf('async function syncArenaAsaasSubaccount'),
    actions.indexOf('function arenaPaymentAccountsTable'),
  )

  assert.match(syncBody, /snapshot\.status\.general === 'APPROVED'/u)
  assert.match(syncBody, /Boolean\(existing\.webhook_token_hash\)/u)
  assert.match(syncBody, /Boolean\(existing\.asaas_account_id\)/u)
  assert.match(syncBody, /Boolean\(existing\.asaas_wallet_id\)/u)
  assert.match(syncBody, /await assertArenaAsaasRuntimeCredentials\(arenaId\)/u)
  assert.match(syncBody, /apply_arena_asaas_manual_status_snapshot/u)
  assert.match(syncBody, /p_snapshot_observed_at: snapshotObservedAt/u)
  assert.match(syncBody, /p_commercial_info_expiration_status: null/u)
  assert.match(syncBody, /existing\.activated_at === null[\s\S]*updated\.activated_at !== null[\s\S]*updated\.status === 'active'/u)
  assert.doesNotMatch(syncBody, /updateArenaPaymentAccount\(/u)
})

test('arena onboarding confirms legal data and follows status automatically', async () => {
  const card = await source('src/modules/arenas/components/ArenaPixSplitSettingsCard.tsx')

  assert.match(card, /companyType: "" as AsaasCompanyType \| ""/u)
  assert.match(card, /Ativar recebimentos online/u)
  assert.match(card, /Confirmar e iniciar ativação/u)
  assert.match(card, /getArenaPixSplitSettingsAction/u)
  assert.match(card, /AUTOMATIC_INITIAL_SYNC_DELAY_MS = 15_000/u)
  assert.match(card, /AUTOMATIC_LOCAL_REFRESH_MS/u)
  assert.match(card, /AUTOMATIC_PROVIDER_RECONCILIATION_MS/u)
  assert.match(card, /syncArenaAsaasSubaccountStatusAction/u)
  assert.match(card, /Atualizar agora/u)
  assert.match(card, /Cadastro recusado/u)
  assert.doesNotMatch(card, /companyType: "LIMITED" as AsaasCompanyType/u)
})
