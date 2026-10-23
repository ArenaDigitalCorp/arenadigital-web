import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs';

test('withdrawn requests remain cancelled in arena read model, without financial/conflict reads', async () => {
  let authorized = 0;
  const arenaId = 'c3000000-0000-4000-8000-000000000001';
  const row = { id: 'c7000000-0000-4000-8000-000000000001', arena_id: arenaId, status: 'cancelled',
    start_time: '2099-10-30T13:00:00Z', end_time: '2099-10-30T14:00:00Z', participants: [], athlete: null, court: null, sport: null, team: null };
  const admin = { from(table) {
    assert.ok(['arenas', 'app_booking_requests', 'app_booking_request_group_items'].includes(table));
    const query = { select() { return this; }, eq() { return this; }, in() { return this; }, order() { return this; }, range() { return this; },
      async single() { return { data: { app_booking_mode: 'pre_booking', accepts_app_booking_requests: true } }; },
      then(resolve) { return Promise.resolve({ data: table === 'app_booking_requests' ? [row] : [], error: null }).then(resolve); },
    };
    return query;
  }, rpc() { throw new Error('Cancelled requests cannot trigger a conflict or payment operation'); } };
  const { getAppBookingRequestsAction } = loadTypescriptModule('src/modules/bookings/actions/appBookingRequestActions.ts', {
    'next/cache': { revalidatePath() {} }, '@/lib/supabase-server': { getSupabaseAdmin: () => admin },
    '@/lib/server-auth': { assertArenaBackofficeAccess: async id => { assert.equal(id, arenaId); authorized++; }, requireAuthenticatedDbUser: async () => { throw new Error('No conflict read expected'); } },
  });
  const result = await getAppBookingRequestsAction(arenaId);
  assert.equal(result.success, true, result.error);
  assert.equal(authorized, 1);
  assert.equal(result.data[0].status, 'cancelled');
  assert.equal(result.data[0].hasConflict, false);
});

test('arena queue recognizes withdrawal and pending-only review actions remain gated', () => {
  const source = readFileSync(new URL('../src/modules/bookings/components/AppBookingRequestsPageClient.tsx', import.meta.url), 'utf8');
  assert.match(source, /label: 'Cancelada pelo atleta'/u);
  assert.match(source, /value: 'cancelled', label: 'Canceladas'/u);
  assert.match(source, /selected\.status === 'pending'/u);
});
