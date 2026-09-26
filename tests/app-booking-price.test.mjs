import assert from 'node:assert/strict'
import test from 'node:test'
import { formatAppBookingPrice } from '../src/modules/bookings/lib/format-app-booking-price.ts'

test('pre-booking quote displays zero as a valid currency amount', () => {
  assert.equal(formatAppBookingPrice(0), 'R$ 0,00')
  assert.equal(formatAppBookingPrice(125.5), 'R$ 125,50')
})
