import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  appHomeContentActionSchema,
  arenaHighlightActionSchema,
  arenaPromotionActionSchema,
  openGameActionSchema,
} from '../src/modules/mobile-content/schemas/mobile-content-action.schema.ts'

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

function exportedFunctionBody(contents, functionName) {
  const start = contents.indexOf(`export async function ${functionName}`)
  assert.notEqual(start, -1, `${functionName} must exist`)
  const next = contents.indexOf('\nexport async function ', start + 1)
  return contents.slice(start, next === -1 ? contents.length : next)
}

const UUID_A = 'a0000000-0000-4000-8000-000000000001'
const UUID_B = 'b0000000-0000-4000-8000-000000000002'

test('mobile content DTOs reject client-owned tenant and audit fields', () => {
  const cases = [
    [appHomeContentActionSchema, { kind: 'announcement', title: 'Aviso' }],
    [arenaPromotionActionSchema, { title: 'Promoção', court_id: UUID_A }],
    [arenaHighlightActionSchema, { title: 'Destaque' }],
    [openGameActionSchema, {
      sport_id: UUID_A,
      owner_atleta_id: UUID_B,
      date: '2026-08-01',
      start_time: '19:00',
      end_time: '20:00',
    }],
  ]

  for (const [schema, valid] of cases) {
    assert.equal(schema.safeParse(valid).success, true)
    for (const reserved of ['arena_id', 'created_at', 'updated_at', 'created_by']) {
      assert.equal(
        schema.safeParse({ ...valid, [reserved]: UUID_A }).success,
        false,
        `${reserved} must be rejected`,
      )
    }
  }
})

test('mobile content service-role writes validate tenant relations and allowlist payloads', async () => {
  const actions = await source('src/modules/mobile-content/actions/mobileContentActions.ts')
  const promotion = exportedFunctionBody(actions, 'upsertArenaPromotionAction')
  const openGame = exportedFunctionBody(actions, 'upsertOpenGameAction')

  assert.match(promotion, /assertArenaAdminAccess\(arenaId\)/)
  assert.match(promotion, /assertCourtAccess\(parsed\.court_id, arenaId\)/)
  assert.doesNotMatch(promotion, /\.\.\.input/)
  assert.match(promotion, /arena_id: arenaId/)

  assert.match(openGame, /assertArenaBackofficeAccess\(arenaId\)/)
  assert.match(openGame, /assertBookingAccess\(parsed\.booking_id, arenaId\)/)
  assert.match(openGame, /assertAthleteBelongsToArena\(arenaId, parsed\.owner_atleta_id\)/)
  assert.doesNotMatch(openGame, /\.\.\.input/)
  assert.match(openGame, /arena_id: arenaId/)
})

test('rotativo actions and repository bind role, resource id and arena id', async () => {
  const [actions, repository] = await Promise.all([
    source('src/modules/rotativos/actions/rotativoActions.ts'),
    source('src/modules/rotativos/repositories/SupabaseRotativoRepository.ts'),
  ])

  for (const name of ['updateRotativoAction', 'setRotativoStatusAction', 'getRotativoByIdAction', 'getParticipantsAction']) {
    const body = exportedFunctionBody(actions, name)
    assert.match(body, /assertArenaBackofficeAccess\(arenaId\)/, `${name} must reject Caixa`)
    assert.match(body, /assertRotativoAccess\(rotativoId, arenaId\)/, `${name} must bind the tenant`)
  }

  assert.match(repository, /update\(arenaId: string, rotativoId: string[\s\S]{0,700}\.eq\('id', rotativoId\)[\s\S]{0,80}\.eq\('id_arena', arenaId\)/)
  assert.match(repository, /setStatus\(arenaId: string, rotativoId: string[\s\S]{0,260}\.eq\('id', rotativoId\)[\s\S]{0,80}\.eq\('id_arena', arenaId\)/)
  assert.match(repository, /findById\(arenaId: string, rotativoId: string[\s\S]{0,220}\.eq\('id_arena', arenaId\)/)
})

test('booking cancellation, update and participant boundaries reject Caixa before mutation', async () => {
  const [bookingActions, participantActions] = await Promise.all([
    source('src/modules/bookings/actions/bookingActions.ts'),
    source('src/modules/bookings/actions/bookingParticipantActions.ts'),
  ])

  for (const name of ['updateBookingStatusAction', 'updateBookingAction']) {
    const body = exportedFunctionBody(bookingActions, name)
    assert.match(body, /assertArenaBackofficeAccess\(arenaId\)/)
    assert.match(body, /assertBookingAccess\(bookingId, arenaId\)/)
  }
  for (const name of ['getBookingParticipantsAction', 'syncBookingParticipantsAction']) {
    const body = exportedFunctionBody(participantActions, name)
    assert.match(body, /assertArenaBackofficeAccess\(arenaId\)/)
    assert.match(body, /assertBookingAccess\(bookingId, arenaId\)/)
  }
})

test('package 27 clients stop on structured failures before local success state', async () => {
  const [mobileClient, rotativoClient] = await Promise.all([
    source('src/modules/mobile-content/components/MobileContentPageClient.tsx'),
    source('src/modules/rotativos/components/CadastradosTab.tsx'),
  ])

  for (const action of ['upsertArenaPromotionAction', 'upsertArenaHighlightAction', 'upsertOpenGameAction']) {
    assert.match(mobileClient, new RegExp(`${action}\\([\\s\\S]{0,700}if \\(!result\\.success\\)[\\s\\S]{0,100}return`))
  }
  assert.match(rotativoClient, /setRotativoStatusAction[\s\S]{0,180}if \(result\.success\)[\s\S]{0,220}else \{[\s\S]{0,80}toast\.error/)
})
