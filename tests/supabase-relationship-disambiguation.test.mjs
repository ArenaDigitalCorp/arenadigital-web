import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

test('booking queries disambiguate the court relationship', async () => {
  const repository = await source(
    'src/modules/bookings/repositories/SupabaseBookingRepository.ts'
  )
  const reports = await source('src/modules/reports/actions/reportActions.ts')

  for (const contents of [repository, reports]) {
    assert.match(contents, /courts!bookings_court_id_fkey\(/)
    assert.doesNotMatch(contents, /(?<![!\w])courts\(/)
  }
})
