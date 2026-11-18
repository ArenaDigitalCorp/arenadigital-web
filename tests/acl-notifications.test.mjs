import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

test('listing, counting and marking notifications use only the current grants', async () => {
  let grants = ['rotativo']
  const filters = []
  const queries = []
  const { getArenaNotificationsAction, markAllNotificationsReadAction, markNotificationReadAction } =
    loadTypescriptModule('src/modules/notifications/actions/notificationActions.ts', {
      '@/lib/server-auth': { async loadArenaResources(id) { assert.equal(id, 'arena-a'); return grants } },
      '@/lib/supabase-server': { getSupabaseAdmin: () => ({ from() {
        const query = { select() { return this }, update() { return this }, order() { return this },
          limit() { return this }, is() { return this }, eq(col, value) {
            if (col === 'arena_id') assert.equal(value, 'arena-a')
            return this
          }, in(key, values) {
            assert.equal(key, 'type')
            filters.push([...values])
            return this
          }, then(resolve) { queries.push(this); resolve({ data: [], count: 0, error: null }) } }
        return query
      } }) },
    })
  assert.equal((await getArenaNotificationsAction('arena-a')).success, true)
  assert.equal((await markNotificationReadAction('arena-a', 'some-id')).success, true)
  grants = ['bookings.single']
  assert.equal((await markAllNotificationsReadAction('arena-a')).success, true)
  assert.equal(queries.length, 4)
  assert.deepEqual(filters, [['rotativo_inscricao'], ['rotativo_inscricao'], ['rotativo_inscricao'], ['booking_created']])
})
