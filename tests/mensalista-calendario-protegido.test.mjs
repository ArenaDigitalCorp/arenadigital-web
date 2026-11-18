import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

const { SupabaseBookingRepository } = loadTypescriptModule('src/modules/bookings/repositories/SupabaseBookingRepository.ts')
const slot = { plano_id: 'plan-1', court_id: 'court-1', inicio: '2048-01-01T23:00:00Z', fim: '2048-01-02T00:00:00Z', athlete_name: 'Mensalista' }
function client({ slots = [slot], rpcError = null } = {}) {
  const calls = []
  const query = { select() { return this }, eq() { return this }, gte() { return this }, lte() { return this }, lt() { return this },
    order: async () => ({ data: [{ id: 'booking-1', court_id: 'court-1', start_time: '2048-01-01T21:00:00Z' }], error: null }),
    single: async () => ({ data: { arena_id: 'arena-1' }, error: null }),
  }
  return { calls, from: () => query, rpc: async (name, input) => { calls.push({ name, input }); return { data: slots, error: rpcError } } }
}

test('calendário mostra reserva existente e horário protegido sem preço de recebimento', async () => {
  const db = client()
  const rows = await new SupabaseBookingRepository(db, ['bookings.single','bookings.recurring']).findByArena('arena-1', '2048-01-01', '2048-02-01')
  assert.equal(rows.length, 2)
  assert.equal(rows[0].id, 'booking-1')
  assert.equal(rows[1].horario_protegido, true)
  assert.equal(rows[1].plano_mensalista_id, 'plan-1')
  assert.equal(rows[1].price, null)
  assert.equal(rows[1].rental_price, 0)
  assert.equal(db.calls[0].input.p_arena_id, 'arena-1')
})

test('calendário da quadra exclui a proteção de outra quadra', async () => {
  const db = client({ slots: [slot, { ...slot, court_id: 'court-2' }] })
  const rows = await new SupabaseBookingRepository(db, ['bookings.single','bookings.recurring']).findByCourt('court-1', '2048-01-01', '2048-02-01')
  assert.equal(rows.length, 2)
  assert.equal(rows.every(row => row.court_id === 'court-1'), true)
})

test('falha ao consultar contratos não transforma horários protegidos em disponíveis', async () => {
  const db = client({ rpcError: { message: 'indisponível' } })
  await assert.rejects(() => new SupabaseBookingRepository(db, ['bookings.single','bookings.recurring']).findByArenaWithSports('arena-1', '2048-01-01', '2048-02-01'), /Não foi possível conferir os horários/)
})

test('recepção vê a ocupação sem receber dados financeiros, vínculos ou nomes dos mensalistas', async () => {
  const sensitive = { id: 'private-booking-id', court_id: 'court-1', start_time: slot.inicio,
    end_time: slot.fim, status: 'confirmed', price: 195, athlete_name: 'Nome privado' }
  const filters = []
  const client = {
    from() {
      let hidden = false
      return {
        select(columns) { hidden = columns === 'court_id,start_time,end_time,status,payment_expires_at'; return this },
        eq() { return this }, or(expr) { filters.push(expr); return this },
        lt() { return this }, gt() { return this }, lte() { return this }, gte() { return this }, in() { return this },
        order: async () => ({ data: [] }),
        then(resolve) { resolve({ data: hidden ? [sensitive] : [] }) },
      }
    },
    rpc: async () => ({ data: [{ ...slot, athlete_name: 'Outro nome privado' }] }),
  }
  const rows = await new SupabaseBookingRepository(client, ['bookings.single'])
    .findByArena('arena-1', '2048-01-01', '2048-02-01')
  assert.equal(filters.length, 2)
  assert.match(filters[0], /plano_mensalista_id.is.null/)
  assert.match(filters[1], /booking_type.eq.mensalista/)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].horario_indisponivel, true)
  assert.equal(rows[0].start_time, slot.inicio)
  assert.doesNotMatch(JSON.stringify(rows), /95|privad|plan-1|private-booking-id/i)
})

test('alteração de avulso recusa reserva mensal da mesma arena e verifica o recurso antes da consulta privilegiada', async () => {
  let calls = 0
  let allowed = false
  let kind = { booking_type: 'avulso', plano_mensalista_id: 'linked' }
  const { assertSingleBookingAccess } = loadTypescriptModule('src/modules/bookings/lib/booking-authorization.ts', {
    'server-only': {},
    '@/lib/server-auth': { assertArenaResourceAccess: async (id, resource) => {
      assert.equal(id, 'arena-1'); assert.equal(resource, 'bookings.single')
      if (!allowed) throw new Error('negado')
    } },
    '@/lib/supabase-server': {getSupabaseAdmin: () => {
      calls++
      const filter = []
      return { from: () => ({
        select() { return this }, eq(key,value) { filter.push([key,value]); return this },
        async maybeSingle() {
          assert.deepEqual(filter, [['arena_id','arena-1'],['id','booking-1']])
          return {data:kind}
        },
      }) }
    }},
  })
  await assert.rejects(() => assertSingleBookingAccess('booking-1','arena-1'), /negado/)
  assert.equal(calls, 0)
  allowed = true
  await assert.rejects(() => assertSingleBookingAccess('booking-1','arena-1'), /indisponível/)
  kind = { booking_type:'mensalista',plano_mensalista_id:null }
  await assert.rejects(() => assertSingleBookingAccess('booking-1','arena-1'), /indisponível/)
  kind = { booking_type:null,plano_mensalista_id:null }
  await assertSingleBookingAccess('booking-1','arena-1')
})
