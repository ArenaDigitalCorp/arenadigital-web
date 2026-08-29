import assert from 'node:assert/strict'
import test from 'node:test'

import {
  lancarCreditoSchema,
  registrarPagamentoSchema,
  retirarCreditoSchema,
  setEncerramentoSchema,
} from '../src/modules/mensalistas/schemas/mensalista.schema.ts'

const arenaId = '11111111-1111-4111-8111-111111111111'
const entityId = '22222222-2222-4222-8222-222222222222'
const operationId = '33333333-3333-4333-8333-333333333333'

test('payment requires a positive cash or credit amount and a UUID operation ID', () => {
  const base = {
    arenaId,
    cobrancaId: entityId,
    operationId,
    valor: 0,
    creditoAplicado: 0,
    data: '2026-08-29',
    modoPagamentoId: null,
    observacao: null,
  }

  assert.equal(registrarPagamentoSchema.safeParse(base).success, false)
  assert.equal(
    registrarPagamentoSchema.safeParse({ ...base, valor: 10 }).success,
    true
  )
  assert.equal(
    registrarPagamentoSchema.safeParse({ ...base, creditoAplicado: 10 }).success,
    true
  )
  assert.equal(
    registrarPagamentoSchema.safeParse({ ...base, operationId: 'retry-1' })
      .success,
    false
  )
})

test('credit and withdrawal schemas reject unsafe monetary inputs', () => {
  const credit = {
    arenaId,
    atletaId: entityId,
    operationId,
    valor: 25,
    descricao: null,
  }

  assert.equal(lancarCreditoSchema.safeParse(credit).success, true)
  assert.equal(
    lancarCreditoSchema.safeParse({ ...credit, arenaId: 'arena-a' }).success,
    false
  )
  assert.equal(
    lancarCreditoSchema.safeParse({ ...credit, valor: 0 }).success,
    false
  )
  assert.equal(retirarCreditoSchema.safeParse(credit).success, true)
  assert.equal(
    retirarCreditoSchema.safeParse({ ...credit, valor: -1 }).success,
    false
  )
})

test('termination accepts a cleared forecast and rejects malformed dates', () => {
  const base = {
    arenaId,
    planoId: entityId,
    dataPrevista: null,
    observacao: null,
  }

  assert.equal(setEncerramentoSchema.safeParse(base).success, true)
  assert.equal(
    setEncerramentoSchema.safeParse({ ...base, dataPrevista: '29/08/2026' })
      .success,
    false
  )
})
