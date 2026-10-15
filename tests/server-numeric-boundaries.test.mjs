import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

const actor = { dbUserId: 'fixture-user' }
const auth = { assertArenaAdminAccess: async () => actor, assertArenaCaixaAccess: async () => actor,
  assertProductAccess: async () => 'arena', assertArenaScopedResourceAccess: async () => {}, requireAuthenticatedDbUser: async () => actor }

test('catalog server create/update rejects empty or coerced prices even when the form is bypassed', async () => {
  let saved
  const current = { name: 'Item', category_id: 'category', price: '25.00', catalog_kind: 'service', status: 'Ativo', stock_quantity: 0 }
  const db = { from(table) { return { select() { return this }, eq() { return this },
    single: async () => ({ data: current, error: null }),
    maybeSingle: async () => ({ data: table === 'product_categories' ? { id: 'category', name: 'Categoria', kind: 'service' } : { id: 'station' }, error: null }),
  } } }
  const { createProductAction, updateProductAction } = loadTypescriptModule('src/modules/products/actions/stockActions.ts', {
    '@/lib/server-auth': auth, '@/lib/supabase-server': { getSupabaseAdmin: () => db },
    '@/modules/products/repositories/SupabaseProductRepository': { SupabaseProductRepository: class {
      async create(payload) { saved = payload; return payload }
      async update(_id, payload) { saved = payload; return payload }
    } }, 'next/cache': { revalidatePath() {} },
  })
  const base = { arena_id: 'arena', name: 'Item', category_id: 'category', catalog_kind: 'service', status: 'Ativo' }
  for (const action of [input => createProductAction('arena', input), input => updateProductAction('arena', 'item', input)]) {
    for (const price of ['', ' ', null, false, true, [], {}, '12oops', '1e3', '1.234']) {
      saved = undefined
      const result = await action({ ...base, price })
      assert.equal(result.success, false, JSON.stringify(price))
      assert.equal(saved, undefined)
    }
    for (const [price, expected] of [[0, 0], ['0', 0], ['12.50', 12.5], ['1.234,56', 1234.56]]) {
      assert.equal((await action({ ...base, price })).success, true)
      assert.equal(saved.price, expected)
    }
  }
  assert.equal((await updateProductAction('arena', 'item', { name: 'Outro' })).success, true)
  assert.equal(saved.price, 25, 'omitting the price keeps the existing numeric value')
})

test('cash opening validates the raw server payload instead of coercing missing values into zero', async () => {
  const requests = []
  const { openCaixaSessionAction } = loadTypescriptModule('src/modules/finance/actions/caixaSessionActions.ts', {
    '@/lib/server-auth': auth, '@/lib/supabase-server': { getSupabaseAdmin: () => ({ rpc: async (name, args) => {
      requests.push({ name, args }); return { data: {}, error: null }
    } }) }, '@/modules/arenas/usecases/get-arena-billing-address.usecase': {}, 'next/cache': { revalidatePath() {} },
  })
  for (const opening_balance of ['', ' ', null, false, true, [], {}, '1e3', '12oops', '1.234']) {
    const before = requests.length
    assert.equal((await openCaixaSessionAction('arena', { opening_balance })).success, false)
    assert.equal(requests.length, before)
  }
  for (const [opening_balance, expected] of [[0, 0], ['0.00', 0], ['1.234,56', 1234.56]]) {
    assert.equal((await openCaixaSessionAction('arena', { opening_balance })).success, true)
    assert.equal(requests.at(-1).args.p_opening_balance, expected)
  }
})

test('transaction server payloads retain complete legacy numeric strings while rejecting type coercion', async () => {
  const requests = []
  const { createTransactionAction } = loadTypescriptModule('src/modules/finance/actions/financeActions.ts', {
    '@/lib/server-auth': auth, '@/lib/supabase-server': { getSupabaseAdmin: () => ({ rpc: async (name, args) => {
      requests.push({ name, args }); return { data: {}, error: null }
    } }) }, '@/modules/finance/repositories/SupabaseFinanceRepository': { SupabaseFinanceRepository: class {} }, 'next/cache': { revalidatePath() {} },
  })
  const base = { type: 'entrada', category: 'Teste', description: 'Teste', quantity: 1, unit_value: 1, discount: 0, total_value: 1,
    launch_date: '2026-10-15', registration_date: '2026-10-15', modo_pagamento_id: '00000000-0000-4000-8000-000000000001' }
  for (const field of ['quantity', 'unit_value', 'discount', 'total_value']) {
    for (const invalid of ['', ' ', null, true, false, [], {}, '1e3', '12oops']) {
      const before = requests.length
      assert.equal((await createTransactionAction('arena', { ...base, [field]: invalid })).success, false, field + '/' + JSON.stringify(invalid))
      assert.equal(requests.length, before)
    }
  }
  assert.equal((await createTransactionAction('arena', { ...base, quantity: '2', unit_value: '1.234,56', discount: '34,56', total_value: '2.434,56' })).success, true)
  assert.equal(requests.at(-1).args.p_quantity, 2)
  assert.equal(requests.at(-1).args.p_unit_value, 1234.56)
  assert.equal(requests.at(-1).args.p_total_value, 2434.56)
})

test('price tables, income, commission and capacity apply the same numeric boundary without changing units', () => {
  const { priceBandSchema, priceDaySchema } = loadTypescriptModule('src/modules/courts/schemas/price-table.schema.ts')
  const { createArenaAsaasSubaccountSchema, updateArenaPixSplitSettingsSchema } = loadTypescriptModule('src/modules/arenas/schemas/asaas-baas.schema.ts')
  const { courtSchema } = loadTypescriptModule('src/modules/courts/schemas/court.schema.ts')
  const band = { start: '08:00', end: '09:00', price: 10 }
  const day = { diaSemana: 1, enabled: true, startTime: '08:00', endTime: '09:00', basePrice: 10, bands: [band] }
  const income = { name: 'Empresa', email: 'fixture@example.invalid', cpfCnpj: '26.472.629/0001-28', companyType: 'LIMITED', mobilePhone: '(48) 99642-6091',
    incomeValue: 1000, address: 'Rua Teste', addressNumber: 'S/N', province: 'Centro', postalCode: '01001000' }
  const commission = { enabled: false, commissionMode: 'percentage_net', commissionFixedCents: 0, platformFeeBasisPoints: 200 }
  const court = { name: 'Quadra', status: 'ativo', type: 'Quadra', booking_type: 'hourly', capacity: 4 }
  for (const invalid of ['', ' ', null, true, false, [], {}, '1e3', '12oops']) {
    assert.equal(priceBandSchema.safeParse({ ...band, price: invalid }).success, false)
    assert.equal(priceDaySchema.safeParse({ ...day, basePrice: invalid }).success, false)
    assert.equal(priceDaySchema.safeParse({ ...day, diaSemana: invalid }).success, false)
    assert.equal(createArenaAsaasSubaccountSchema.safeParse({ ...income, incomeValue: invalid }).success, false)
    assert.equal(updateArenaPixSplitSettingsSchema.safeParse({ ...commission, platformFeeBasisPoints: invalid }).success, false)
    assert.equal(courtSchema.safeParse({ ...court, capacity: invalid }).success, false)
  }
  assert.equal(priceBandSchema.parse({ ...band, price: '1.234,56' }).price, 1234.56)
  assert.equal(priceBandSchema.parse({ ...band, price: '0' }).price, 0)
  assert.equal(createArenaAsaasSubaccountSchema.parse({ ...income, incomeValue: '1.234,56' }).incomeValue, 1234.56)
  assert.equal(updateArenaPixSplitSettingsSchema.parse({ ...commission, platformFeeBasisPoints: '250' }).platformFeeBasisPoints, 250)
  assert.equal(courtSchema.parse({ ...court, capacity: '4' }).capacity, 4)
  assert.equal(courtSchema.safeParse({ ...court, capacity: 4.5 }).success, false)
})
