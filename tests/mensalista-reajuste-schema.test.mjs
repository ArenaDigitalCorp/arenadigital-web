import assert from 'node:assert/strict'
import test from 'node:test'

import { reajustarValorSchema } from '../src/modules/mensalistas/schemas/mensalista.schema.ts'

const base = {
  arenaId: '11111111-1111-4111-8111-111111111111',
  planoId: '22222222-2222-4222-8222-222222222222',
  operationId: '33333333-3333-4333-8333-333333333333',
  novoValor: 260,
  escopo: 'mes_seguinte',
  observacao: null,
}

test('reajustarValorSchema accepts a valid payload', () => {
  assert.equal(reajustarValorSchema.safeParse(base).success, true)
  assert.equal(
    reajustarValorSchema.safeParse({ ...base, escopo: 'mes_atual', observacao: '  ajuste  ' })
      .data.observacao,
    'ajuste'
  )
})

test('reajustarValorSchema rejects bad escopo, negative value and non-uuid ids', () => {
  assert.equal(reajustarValorSchema.safeParse({ ...base, escopo: 'proximo_ano' }).success, false)
  assert.equal(reajustarValorSchema.safeParse({ ...base, novoValor: -1 }).success, false)
  assert.equal(reajustarValorSchema.safeParse({ ...base, operationId: 'nope' }).success, false)
  assert.equal(
    reajustarValorSchema.safeParse({ ...base, observacao: 'x'.repeat(401) }).success,
    false
  )
})

test('reajustarValorSchema allows zero (free plan) and large values', () => {
  assert.equal(reajustarValorSchema.safeParse({ ...base, novoValor: 0 }).success, true)
  assert.equal(reajustarValorSchema.safeParse({ ...base, novoValor: 100_000_000 }).success, true)
  assert.equal(reajustarValorSchema.safeParse({ ...base, novoValor: 100_000_001 }).success, false)
})
