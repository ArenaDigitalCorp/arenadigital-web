import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

const arenaId = 'arena-a'
const stations = [
  { arena_id: arenaId, id: 'bar', name: 'Bar' },
  { arena_id: arenaId, id: 'recepcao', name: 'Recepção' },
  { arena_id: 'arena-b', id: 'loja', name: 'Loja' },
]
const orders = stations.map((station, index) => ({
  id: `comanda-${station.id}`,
  arena_id: station.arena_id,
  station_id: station.id,
  station: { name: station.name },
  customer_name: `Cliente ${station.name}`,
  order_number: index + 1,
  created_at: '2026-11-18T09:00:00Z',
  status: 'open',
  pending_marked_at: null,
  total_value: 0,
  station_payments: [],
}))

function movementReport(role, assignedStationId = null, hasReportAccess = true) {
  const reads = []
  const data = { stations, station_orders: orders }
  const client = {
    from(table) {
      let rows = data[table]
      assert.ok(rows, `Unexpected table: ${table}`)
      return {
        select() { return this },
        order() { return this },
        eq(key, value) {
          rows = rows.filter(row => row[key] === value)
          return this
        },
        range(start, end) {
          return this.then(result => ({ ...result, data: result.data.slice(start, end + 1) }))
        },
        then(resolve, reject) {
          reads.push({ table, ids: rows.map(row => row.id) })
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject)
        },
      }
    },
  }
  const mod = loadTypescriptModule('src/modules/reports/actions/stationMovementActions.ts', {
    '@/lib/server-auth': {
      async assertArenaResourceAccess(requestedArena, resource) {
        assert.equal(requestedArena, arenaId)
        assert.equal(resource, 'reports.stations')
        if (!hasReportAccess) throw new Error('Seu perfil não tem acesso a este recurso.')
        return { arenaId, role, assignedStationId, isOwner: role === 'Owner' }
      },
    },
    '@/lib/supabase-server': { getSupabaseAdmin: () => client },
  })
  return { run: filters => mod.getStationMovementReportAction(arenaId, filters), reads }
}

function assertReport(result, rowStations, stationOptions) {
  assert.equal(result.success, true, result.error)
  assert.deepEqual(Array.from(result.rows, row => row.station_id).sort(), [...rowStations].sort())
  assert.deepEqual(Array.from(result.stations, station => station.id).sort(), [...stationOptions].sort())
}

test('Todas and the assigned station return only that cashier’s orders and filter option', async () => {
  for (const station of ['bar', 'recepcao']) {
    const { run, reads } = movementReport('Caixa', station)
    assertReport(await run(), [station], [station])
    assertReport(await run({ stationId: station }), [station], [station])
    for (const read of reads) {
      assert.deepEqual(read.ids, [read.table === 'stations' ? station : `comanda-${station}`])
    }
  }
})

test('a station selection left over from a previous assignment returns no orders', async () => {
  const { run } = movementReport('Caixa', 'bar')
  assertReport(await run({ stationId: 'recepcao' }), [], ['bar'])
})

test('an empty search result keeps the cashier’s assigned station available in the selector', async () => {
  const { run } = movementReport('Caixa', 'recepcao')
  assertReport(await run({ status: 'closed' }), [], ['recepcao'])
  assertReport(await run({ customer: ' , ' }), [], ['recepcao'])
})

test('a cashier without an assignment or with a station outside the arena has an empty report', async () => {
  for (const assignedStation of [null, 'loja']) {
    const { run } = movementReport('Caixa', assignedStation)
    assertReport(await run(), [], [])
    assertReport(await run({ stationId: 'bar' }), [], [])
  }
})

test('other authorized roles retain the arena-wide report and can narrow it by station', async () => {
  for (const role of ['Gestor', 'Owner', 'Atendente']) {
    const { run } = movementReport(role)
    assertReport(await run(), ['bar', 'recepcao'], ['bar', 'recepcao'])
    assertReport(await run({ stationId: 'recepcao' }), ['recepcao'], ['bar', 'recepcao'])
  }
})

test('the report permission is required before loading orders or filter options', async () => {
  const { run, reads } = movementReport('Caixa', 'bar', false)
  const result = await run()
  assert.equal(result.success, false)
  assert.match(result.error, /acesso/)
  assert.deepEqual(reads, [])
})
