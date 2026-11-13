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
  const rows = await new SupabaseBookingRepository(db).findByArena('arena-1', '2048-01-01', '2048-02-01')
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
  const rows = await new SupabaseBookingRepository(db).findByCourt('court-1', '2048-01-01', '2048-02-01')
  assert.equal(rows.length, 2)
  assert.equal(rows.every(row => row.court_id === 'court-1'), true)
})

test('falha ao consultar contratos não transforma horários protegidos em disponíveis', async () => {
  const db = client({ rpcError: { message: 'indisponível' } })
  await assert.rejects(() => new SupabaseBookingRepository(db).findByArenaWithSports('arena-1', '2048-01-01', '2048-02-01'), /Não foi possível conferir os horários/)
})
