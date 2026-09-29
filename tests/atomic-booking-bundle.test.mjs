import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const actions = readFileSync(
  new URL('../src/modules/bookings/actions/bookingActions.ts', import.meta.url),
  'utf8',
)
const modal = readFileSync(
  new URL('../src/modules/bookings/components/BookingModal.tsx', import.meta.url),
  'utf8',
)
const rotativoSchema = readFileSync(
  new URL('../src/modules/rotativos/schemas/rotativo.schema.ts', import.meta.url),
  'utf8',
)

test('booking modal submits one atomic bundle and checks the action result', () => {
  assert.match(modal, /saveBackofficeBookingBundleAction\(arenaId,/)
  assert.match(modal, /if \(!result\.success\)/)
  assert.doesNotMatch(modal, /replaceBookingServicesAction/)
  assert.doesNotMatch(modal, /syncBookingParticipantsAction/)
  assert.doesNotMatch(modal, /createRecurringBookingsAction/)
  assert.doesNotMatch(modal, /updateBookingAction\(arenaId/)
})

test('booking operation and recurrence keys remain stable across retries', () => {
  assert.match(modal, /const bookingOperationId = useRef<string \| null>\(null\)/)
  assert.match(modal, /operationId: bookingOperationId\.current/)
  assert.match(modal, /recurrenceId: isRecurring \? bookingOperationId\.current : null/)
  assert.match(modal, /if \(!result\.success\)[\s\S]{0,260}bookingOperationId\.current = null/)
})

test('server action authorizes tenant scope and allowlists bundle fields', () => {
  const bundle = actions.slice(
    actions.indexOf('export async function saveBackofficeBookingBundleAction'),
    actions.indexOf('type BookingConflictRow'),
  )
  assert.match(bundle, /assertArenaBackofficeAccess\(arenaId\)/)
  assert.match(bundle, /assertCourtAccess\(input\.courtId, arenaId\)/)
  assert.match(bundle, /assertBookingAccess\(input\.updateBookingId, arenaId\)/)
  assert.match(bundle, /p_registered_by: dbUserId/)
  assert.doesNotMatch(bundle, /p_registered_by: input\./)
  assert.match(bundle, /p_responsible_athlete_id: input\.athleteId/)
  // Rateio: o valor por pessoa legado nunca é enviado; as partes vão em p_rateio,
  // montadas campo a campo (sem repassar o objeto do cliente).
  assert.match(bundle, /p_participant_value: null/)
  assert.match(bundle, /p_rateio: safeRateio/)
  assert.match(bundle, /cobranca_id: r\.cobrancaId \?\? null,\s+atleta_id: r\.atletaId,\s+nome: r\.nome\?\.trim\(\) \|\| null,\s+valor: Math\.round\(r\.valor \* 100\) \/ 100,\s+responsavel: Boolean\(r\.responsavel\)/)
  assert.doesNotMatch(bundle, /p_participant_value: input\.participant/)
  assert.match(bundle, /rpc\('save_backoffice_booking_bundle_atomic'/)
})

test('empty rotativo package replacement fails validation', () => {
  assert.match(rotativoSchema, /z\.array\(rotativoPacoteSchema\)\.min\(1,/)
})
