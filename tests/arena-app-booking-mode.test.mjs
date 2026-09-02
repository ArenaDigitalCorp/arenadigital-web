import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  appBookingModeAcceptsPreBookings,
  normalizeAppBookingMode,
} from '../src/modules/arenas/domain/app-booking-mode.ts'

test('new arenas and invalid values fail to the disabled mode', () => {
  assert.equal(normalizeAppBookingMode(undefined), 'disabled')
  assert.equal(normalizeAppBookingMode('unexpected'), 'disabled')
})

test('legacy pre-booking opt-ins remain enabled during migration', () => {
  assert.equal(normalizeAppBookingMode(undefined, true), 'pre_booking')
  assert.equal(normalizeAppBookingMode('pre_booking', false), 'pre_booking')
})

test('an explicit disabled mode wins over a stale legacy opt-in', () => {
  assert.equal(normalizeAppBookingMode('disabled', true), 'disabled')
})

test('only the pre-booking mode projects to the legacy boolean', () => {
  assert.equal(appBookingModeAcceptsPreBookings('disabled'), false)
  assert.equal(appBookingModeAcceptsPreBookings('pre_booking'), true)
  assert.equal(appBookingModeAcceptsPreBookings('online_payment'), false)
})
