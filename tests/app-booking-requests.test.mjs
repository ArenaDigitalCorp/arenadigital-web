import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const action = readFileSync(
  new URL('../src/modules/bookings/actions/appBookingRequestActions.ts', import.meta.url),
  'utf8',
)
const page = readFileSync(
  new URL('../src/modules/bookings/components/AppBookingRequestsPageClient.tsx', import.meta.url),
  'utf8',
)
const bookingSettings = readFileSync(
  new URL('../src/modules/arenas/components/ArenaAppBookingSettingsCard.tsx', import.meta.url),
  'utf8',
)
const sidebar = readFileSync(
  new URL('../src/components/dashboard/Sidebar.tsx', import.meta.url),
  'utf8',
)

test('arena setting is explicit and defaults off', () => {
  assert.match(bookingSettings, /normalizeAppBookingMode/u)
  assert.match(bookingSettings, /value: "disabled"/u)
  assert.match(bookingSettings, /value: "pre_booking"/u)
  assert.match(bookingSettings, /value: "online_payment"/u)
  assert.match(bookingSettings, /onlineBookingReady/u)
  assert.match(bookingSettings, /Concluir configuração abaixo/u)
})

test('request queue is tenant-authorized and reviews only through the service RPC', () => {
  assert.match(action, /assertArenaBackofficeAccess\(arenaId\)/u)
  assert.match(action, /assertArenaBackofficeAccess\(parsed\.arenaId\)/u)
  assert.match(action, /the previous DB during the[\s\S]*\.select\('\*'\)/u)
  assert.match(action, /appBookingModeAcceptsPreBookings/u)
  assert.match(action, /rpc\([\s\S]*'review_app_booking_request'/u)
  assert.doesNotMatch(action, /\.from\('app_booking_requests'\)\s*\.update/u)
})

test('operators can see conflicts before attempting approval', () => {
  assert.match(action, /booking\.start_time[\s\S]*row\.end_time/u)
  assert.match(page, /horário não está mais disponível/u)
  assert.match(page, /disabled=\{isPending \|\| selected\.hasConflict\}/u)
})

test('pre-booking queue is a dedicated sidebar destination', () => {
  assert.match(sidebar, /label: "Pré-reservas"/u)
  assert.match(sidebar, /\/pre-reservas/u)
})
