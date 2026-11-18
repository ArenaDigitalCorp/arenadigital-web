import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

test('cashier can sell station items without catalog or athlete administration permissions', async () => {
  const stock = new Map([
    ['stations', { station_type_id: 'bar' }],
    ['products', [
      { id: 'local', station_id: 'one' },
      { id: 'foreign', station_id: 'two' },
      { id: 'type', station_type_id: 'bar' },
      { id: 'other-type', station_type_id: 'loja' },
      { id: 'service', catalog_kind: 'service' },
    ]],
  ])
  const projections = []
  const pickers = loadTypescriptModule('src/modules/stations/actions/stationPickerActions.ts', {
    '@/lib/server-auth': {
      async assertStationAccess(station, arena) {
        if (station !== 'one' || arena !== 'arena-a') throw new Error('Acesso negado')
      },
    },
    '@/lib/supabase-server': { getSupabaseAdmin: () => ({ from(table) {
      return {
        select(columns) { projections.push([table, columns]); return this },
        eq() { return this },
        async single() { return { data: stock.get(table), error: null } },
        async order() { return { data: stock.get(table), error: null } },
      }
    } }) },
  })
  await assert.rejects(pickers.getStationSaleProducts('arena-a', 'two'), /Acesso negado/)
  await assert.rejects(pickers.searchStationCustomers('arena-b', 'one', 'ana'), /Acesso negado/)
  assert.deepEqual(projections, [])
  const products = await pickers.getStationSaleProducts('arena-a', 'one')
  assert.deepEqual(products.map(item => item.id), ['local', 'type', 'service'])
  assert.match(projections[1][1], /price,stock_quantity/)
  assert.doesNotMatch(projections[1][1], /\*|cost|invoice/)
})
