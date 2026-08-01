import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(
  new URL('../src/modules/bookings/actions/bookingServiceActions.ts', import.meta.url),
  'utf8',
)

test('booking service mutations use only the atomic RPC', () => {
  assert.match(source, /rpc\("replace_booking_services_atomic"/u)
  assert.doesNotMatch(source, /from\("booking_services"\)\.delete/u)
  assert.doesNotMatch(source, /from\("booking_services"\)\.insert/u)
  assert.doesNotMatch(source, /updateBookingTotalPriceAction/u)
})

test('service synchronization no longer accepts a client total price', () => {
  const syncSource = source.slice(source.indexOf('export async function syncBookingServicesAndTotalAction'))
  assert.doesNotMatch(syncSource, /totalPrice/u)
  assert.match(syncSource, /return replaceBookingServicesAction\(arenaId, bookingId, lines\)/u)
})
