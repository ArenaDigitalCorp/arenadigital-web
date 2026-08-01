import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const actionPath = new URL(
  '../src/modules/bookings/actions/mensalistaActions.ts',
  import.meta.url
)

const componentPaths = [
  '../src/modules/bookings/components/MensalistasView.tsx',
  '../src/modules/bookings/components/MensalistasPageClient.tsx',
  '../src/modules/finance/components/FinanceDashboardClient.tsx',
].map((path) => new URL(path, import.meta.url))

test('mensalista mutations route exclusively through the three atomic RPCs', async () => {
  const source = await readFile(actionPath, 'utf8')

  for (const rpcName of [
    'create_monthly_plan_atomic',
    'cancel_monthly_plan_atomic',
    'confirm_monthly_plan_month_atomic',
  ]) {
    assert.match(source, new RegExp(`\\.rpc\\(\\s*['"]${rpcName}['"]`))
  }

  assert.doesNotMatch(source, /\.from\(['"]planos_mensalista['"]\)\s*\.insert/)
  assert.doesNotMatch(source, /\.from\(['"]planos_mensalista['"]\)\s*\.update/)
  assert.doesNotMatch(source, /\.from\(['"]bookings['"]\)\s*\.(?:insert|update)/)
  assert.doesNotMatch(source, /\.from\(['"]transactions['"]\)\s*\.insert/)
  assert.doesNotMatch(source, /syncBookingParticipantsForBooking/)
})

test('identity and confirmation price are not overposted to monthly RPCs', async () => {
  const source = await readFile(actionPath, 'utf8')
  const createCall = source.slice(
    source.lastIndexOf("'create_monthly_plan_atomic'"),
    source.lastIndexOf("'cancel_monthly_plan_atomic'")
  )
  const confirmCall = source.slice(
    source.lastIndexOf("'confirm_monthly_plan_month_atomic'"),
    source.indexOf('/* Legacy multi-step mutations')
  )

  assert.doesNotMatch(createCall, /p_athlete_name/)
  assert.doesNotMatch(confirmCall, /p_(?:amount|price|valor)/)
  assert.match(source, /void valorOverride/)
  assert.match(confirmCall, /p_expected_booking_start/)
})

test('every monthly confirmation caller sends the displayed pending booking', async () => {
  const sources = await Promise.all(
    componentPaths.map((path) => readFile(path, 'utf8'))
  )

  assert.match(sources[0], /confirmDialog\.proximo_mes_reservado as string/)
  assert.match(sources[1], /plano\.proximo_mes_reservado as string/)
  assert.match(sources[2], /confirmDialog\.expectedBookingStart/)
  assert.match(sources[2], /expectedBookingStart: plano\.proximo_mes_reservado/)
})

test('monthly action input validation covers tenant identifiers and schedule bounds', async () => {
  const source = await readFile(actionPath, 'utf8')

  assert.match(source, /z\.string\(\)\.uuid\(\)/)
  assert.match(source, /assertCourtAccess\(parsed\.court_id, arenaId\)/)
  assert.match(source, /assertMonthlyPlanAthletes/)
  assert.match(source, /sessoes_por_mes: z\.number\(\)\.int\(\)\.min\(1\)\.max\(8\)/)
  assert.match(source, /horario_fim > input\.horario_inicio/)
})
