import assert from 'node:assert/strict'
import test from 'node:test'

import { fetchAllSupabaseRows } from '../src/lib/supabase-pagination.ts'

function fakeRangeQuery(rows, failurePage = null) {
  const ranges = []
  return {
    ranges,
    range(from, to) {
      ranges.push([from, to])
      const page = ranges.length
      if (failurePage === page) {
        return Promise.resolve({
          data: null,
          error: { message: 'simulated PostgREST failure', code: 'PGRST500' },
        })
      }
      return Promise.resolve({ data: rows.slice(from, to + 1), error: null })
    },
  }
}

test('fetchAllSupabaseRows reads every page beyond the 1,000 row cap', async () => {
  const rows = Array.from({ length: 2_505 }, (_, id) => ({ id }))
  const query = fakeRangeQuery(rows)

  const result = await fetchAllSupabaseRows(query)

  assert.equal(result.error, null)
  assert.deepEqual(result.data, rows)
  assert.deepEqual(query.ranges, [
    [0, 999],
    [1000, 1999],
    [2000, 2999],
  ])
})

test('fetchAllSupabaseRows stops and returns the source error', async () => {
  const query = fakeRangeQuery(Array.from({ length: 1_500 }, (_, id) => ({ id })), 2)

  const result = await fetchAllSupabaseRows(query)

  assert.equal(result.data, null)
  assert.deepEqual(result.error, {
    message: 'simulated PostgREST failure',
    code: 'PGRST500',
  })
  assert.deepEqual(query.ranges, [
    [0, 999],
    [1000, 1999],
  ])
})

test('fetchAllSupabaseRows rejects invalid page sizes before querying', async () => {
  const query = fakeRangeQuery([])

  await assert.rejects(
    fetchAllSupabaseRows(query, 0),
    /page size must be a positive integer/
  )
  assert.deepEqual(query.ranges, [])
})
