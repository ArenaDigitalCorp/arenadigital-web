import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createPriceTableSchema,
  priceBandSchema,
  priceDaySchema,
  upsertPriceTableSchema,
} from '../src/modules/courts/schemas/price-table.schema.ts'
import {
  MAX_PRICE_TABLES_PER_COURT,
  RESERVED_PRICE_TABLE_KINDS,
  defaultPriceTableName,
  isReservedPriceTableKind,
} from '../src/modules/courts/types/price-table.types.ts'

const courtId = '11111111-1111-4111-8111-111111111111'
const tableId = '22222222-2222-4222-8222-222222222222'

test('priceBandSchema rejects malformed times and negative price', () => {
  assert.equal(priceBandSchema.safeParse({ start: '8:00', end: '09:00', price: 10 }).success, false)
  assert.equal(priceBandSchema.safeParse({ start: '08:00', end: '09:00', price: -1 }).success, false)
  assert.equal(priceBandSchema.safeParse({ start: '08:00', end: '09:00', price: 120 }).success, true)
})

test('priceDaySchema defaults bands and slotShiftTime', () => {
  const parsed = priceDaySchema.parse({
    diaSemana: 1,
    enabled: true,
    startTime: '08:00',
    endTime: '23:00',
    basePrice: 100,
  })
  assert.deepEqual(parsed.bands, [])
  assert.equal(parsed.slotShiftTime, null)
})

test('priceDaySchema keeps dia_semana within 0..6', () => {
  assert.equal(
    priceDaySchema.safeParse({
      diaSemana: 7,
      enabled: false,
      startTime: '08:00',
      endTime: '23:00',
      basePrice: 0,
    }).success,
    false,
  )
})

test('upsertPriceTableSchema requires a court and accepts up to 7 days', () => {
  const base = {
    tableId,
    courtId,
    nome: 'Mensalista',
    tipo: 'mensalista',
    days: Array.from({ length: 7 }, (_, i) => ({
      diaSemana: i,
      enabled: i < 5,
      startTime: '08:00',
      endTime: '23:00',
      basePrice: 130,
      bands: [],
    })),
  }
  const parsed = upsertPriceTableSchema.parse(base)
  assert.equal(parsed.days.length, 7)
  assert.equal(parsed.isDefault, false)
  assert.equal(parsed.ativo, true)

  assert.equal(
    upsertPriceTableSchema.safeParse({ ...base, courtId: 'not-a-uuid' }).success,
    false,
  )
  assert.equal(
    upsertPriceTableSchema.safeParse({ ...base, days: [...base.days, base.days[0]] }).success,
    false,
  )
})

test('createPriceTableSchema trims and length-checks the name', () => {
  assert.equal(createPriceTableSchema.safeParse({ courtId, nome: 'A' }).success, false)
  assert.equal(
    createPriceTableSchema.parse({ courtId, nome: '  Day use  ' }).nome,
    'Day use',
  )
})

test('reserved price table helpers', () => {
  assert.equal(MAX_PRICE_TABLES_PER_COURT, 5)
  assert.deepEqual(RESERVED_PRICE_TABLE_KINDS, ['padrao', 'mensalista', 'professor'])
  assert.equal(isReservedPriceTableKind('padrao'), true)
  assert.equal(isReservedPriceTableKind('custom'), false)
  assert.equal(defaultPriceTableName('professor'), 'Professor')
  assert.equal(defaultPriceTableName('custom'), 'Nova tabela')
})
