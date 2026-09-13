import assert from 'node:assert/strict'
import test from 'node:test'

import { reajustarValorSchema } from '../src/modules/mensalistas/schemas/mensalista.schema.ts'

const base = {
  arenaId: '11111111-1111-4111-8111-111111111111',
  planoId: '22222222-2222-4222-8222-222222222222',
  operationId: '33333333-3333-4333-8333-333333333333',
  novoValor: 260,
  escopo: 'mes_seguinte',
  competencia: '2026-10-01',
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

test('reajustarValorSchema aceita o ajuste pontual de um mês', () => {
  assert.equal(
    reajustarValorSchema.safeParse({ ...base, escopo: 'somente_mes' }).success,
    true
  )
})

test('a competência é obrigatória e tem que ser o dia 1º', () => {
  // É a âncora da vigência: sem ela o servidor voltaria a decidir pelo relógio.
  const { competencia: _omitida, ...semCompetencia } = base
  assert.equal(reajustarValorSchema.safeParse(semCompetencia).success, false)
  assert.equal(reajustarValorSchema.safeParse({ ...base, competencia: '2026-10' }).success, false)
  assert.equal(reajustarValorSchema.safeParse({ ...base, competencia: '2026-10-15' }).success, false)
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
