import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const actions = readFileSync(
  new URL('../src/modules/arenas/actions/arenaActions.ts', import.meta.url),
  'utf8',
)
const card = readFileSync(
  new URL('../src/modules/arenas/components/ArenaPixSplitSettingsCard.tsx', import.meta.url),
  'utf8',
)
const editPage = readFileSync(
  new URL('../src/app/dashboard/arenas/[id]/edit/page.tsx', import.meta.url),
  'utf8',
)

function exportedFunctionBody(name) {
  const start = actions.indexOf(`export async function ${name}`)
  assert.notEqual(start, -1, `${name} must exist`)
  const next = actions.indexOf('\nexport async function ', start + 1)
  return actions.slice(start, next === -1 ? actions.length : next)
}

test('arena Owner or Gestor can create, read and sync their own financial onboarding', () => {
  assert.match(actions, /function assertArenaFinancialOnboardingAccess/u)
  assert.match(actions, /assertArenaAdminAccess\(arenaId\)/u)
  assert.match(actions, /assertPlatformSuperAdminAccess\(\)/u)
  assert.match(exportedFunctionBody('getArenaPixSplitSettingsAction'), /assertArenaFinancialOnboardingAccess/u)
  assert.match(exportedFunctionBody('createArenaAsaasSubaccountAction'), /assertArenaFinancialOnboardingAccess/u)
  assert.match(exportedFunctionBody('syncArenaAsaasSubaccountStatusAction'), /assertArenaFinancialOnboardingAccess/u)
})

test('credential recovery and platform fee activation remain Super Admin operations', () => {
  assert.match(exportedFunctionBody('recoverArenaAsaasSubaccountCredentialAction'), /assertPlatformSuperAdminAccess/u)
  assert.match(exportedFunctionBody('updateArenaPixSplitSettingsAction'), /assertPlatformSuperAdminAccess/u)
})

test('arena edit exposes onboarding without exposing platform operational controls', () => {
  assert.match(editPage, /getArenaPixSplitSettingsAction\(id\)/u)
  assert.match(editPage, /accessMode="arena"/u)
  assert.match(card, /isApproved && isPlatform/u)
  assert.match(card, /isApproved && !isPlatform/u)
  assert.match(card, /política de cancelamento/u)
  assert.match(actions, /settingsForFinancialOnboardingAccess/u)
  assert.match(actions, /asaasWalletId: ''/u)
  assert.match(actions, /asaasAccountId: ''/u)
  assert.match(actions, /pixKey: ''/u)
})

test('self-service financial changes are identified in the audit trail', () => {
  assert.match(actions, /source: 'arena_self_service'/u)
  assert.match(actions, /source: profile\.source/u)
})
