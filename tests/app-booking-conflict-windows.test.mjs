import assert from 'node:assert/strict'
import test from 'node:test'
import { buildBookingConflictWindows } from '../src/modules/bookings/lib/app-booking-conflict-windows.ts'

test('conflict previews do not scan across distant booking dates', () => {
  const windows = buildBookingConflictWindows([
    { courtId: 'court-a', startTime: '2026-10-01T09:00:00Z', endTime: '2026-10-01T10:00:00Z' },
    { courtId: 'court-a', startTime: '2027-10-01T09:00:00Z', endTime: '2027-10-01T10:00:00Z' },
  ])
  assert.equal(windows.length, 2)
  assert.equal(windows[0].endTime, '2026-10-01T10:00:00Z')
  assert.equal(windows[1].startTime, '2027-10-01T09:00:00Z')
})

test('overlapping or touching intervals in the same court share one window', () => {
  const windows = buildBookingConflictWindows([
    { courtId: 'court-a', startTime: '2026-10-01T10:00:00Z', endTime: '2026-10-01T11:00:00Z' },
    { courtId: 'court-a', startTime: '2026-10-01T09:00:00Z', endTime: '2026-10-01T10:00:00Z' },
    { courtId: 'court-b', startTime: '2026-10-01T09:00:00Z', endTime: '2026-10-01T11:00:00Z' },
  ])
  assert.deepEqual(windows, [
    { courtId: 'court-a', startTime: '2026-10-01T09:00:00Z', endTime: '2026-10-01T11:00:00Z' },
    { courtId: 'court-b', startTime: '2026-10-01T09:00:00Z', endTime: '2026-10-01T11:00:00Z' },
  ])
})
