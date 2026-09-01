import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const [actions, schema, component, editPage] = await Promise.all([
  readFile(new URL('../src/modules/arenas/actions/cancellationPolicyActions.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/arenas/schemas/cancellation-policy.schema.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/arenas/components/ArenaCancellationPolicyCard.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/app/dashboard/arenas/[id]/edit/page.tsx', import.meta.url), 'utf8'),
])

test('cancellation policy configuration is available in the Arena-owned settings journey', () => {
  assert.match(editPage, /assertArenaAdminAccess\(id\)/u)
  assert.match(editPage, /ArenaCancellationPolicyCard/u)
  assert.match(actions, /assertArenaAdminAccess\(arenaId\)/gu)
  assert.match(actions, /createSupabaseServerClient/u)
  assert.doesNotMatch(actions, /assertPlatformSuperAdminAccess/u)
})

test('server actions preserve tenant scope before saving or publishing a policy id', () => {
  assert.match(actions, /settings\.draftPolicy\?\.id !== policyId/u)
  assert.match(actions, /O rascunho informado não pertence a esta Arena ou já foi publicado/u)
  assert.match(actions, /replace_arena_cancellation_policy_tiers/u)
  assert.match(actions, /publish_arena_cancellation_policy/u)
})

test('web validation mirrors the database safe coverage and percentage contract', () => {
  assert.match(schema, /minimumHoursBeforeStart: z\.number\(\)\.int\(\)\.min\(0\)/u)
  assert.match(schema, /refundPercentage: z\.number\(\)\.int\(\)\.min\(0\)\.max\(100\)/u)
  assert.match(schema, /Não repita a mesma antecedência/u)
  assert.match(schema, /thresholds\.has\(0\)/u)
})

test('draft UX does not silently publish a suggested commercial policy', () => {
  assert.match(component, /Nenhum valor sugerido será ativado automaticamente/u)
  assert.match(component, /Criar rascunho/u)
  assert.match(component, /Alterações não salvas/u)
  assert.match(component, /Depois da publicação, esta versão e suas faixas não poderão ser editadas/u)
  assert.match(component, /disabled=\{busy !== null \|\| isDirty \|\| settings\.draftPolicy\.tiers\.length === 0\}/u)
  assert.doesNotMatch(component, /refundPercentage:\s*"(?:50|100)"/u)
})
