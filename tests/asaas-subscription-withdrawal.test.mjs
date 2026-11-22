import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

const [{ AsaasWithdrawalGateway, withdrawalRefundState }, { PaymentApiError }] = loadTypescriptModule([
  'src/modules/payments/gateway/asaas-withdrawal.ts', 'src/modules/payments/errors.ts',
])

const scope = { subscriptionId: 'sub_original', customerId: 'cus_original' }
const initial = {
  id: 'pay_first', customer: scope.customerId, subscription: scope.subscriptionId,
  value: 19.90, status: 'CONFIRMED', billingType: 'CREDIT_CARD',
  dueDate: '2026-11-22', dateCreated: '2026-11-22', confirmedDate: '2026-11-22',
}

test('only confirmed entries whose exact total was paid complete a withdrawal', () => {
  assert.equal(withdrawalRefundState(initial, 1990), 'eligible')
  assert.equal(withdrawalRefundState({ status: 'REFUNDED' }, 1990), 'needs_reconciliation')
  assert.equal(withdrawalRefundState({ status: 'REFUNDED', refunds: [{ value: 19.89, status: 'DONE' }] }, 1990), 'needs_reconciliation')
  assert.equal(withdrawalRefundState({ status: 'REFUND_IN_PROGRESS', refunds: [{ value: 19.9, status: 'PENDING' }] }, 1990), 'pending')
  assert.equal(withdrawalRefundState({ status: 'REFUNDED', refunds: [{ value: 19.9, status: 'DONE' }] }, 1990), 'completed')
})

test('selects the first paid card charge, stops its own recurrence, and requests the full amount', async () => {
  const after = { ...initial, status: 'REFUNDED', refunds: [{ status: 'DONE', value: 19.90 }] }
  const calls = []
  const gateway = new AsaasWithdrawalGateway({
    async request(method, path, options) {
      calls.push([method, path, options?.body])
      if (path.includes('/payments?')) {
        return { offset: 0, hasMore: false, data: [
          { ...initial, id: 'pay_second', dueDate: '2026-12-22', dateCreated: '2026-12-01' }, initial,
        ] }
      }
      if (path.endsWith('/refund')) return after
      if (path.endsWith('/pay_first')) return after
      return { id: scope.subscriptionId, customer: scope.customerId, deleted: method === 'DELETE' }
    },
  })
  const charge = await gateway.findFirstPayment(scope, '2026-11-22T18:31:00.000Z')
  assert.equal(charge.paymentId, initial.id)
  assert.equal(charge.amountCents, 1990)
  const refund = { ...scope, ...charge }
  assert.equal(await gateway.stopSubscription(refund, async () => true), true)
  assert.equal(await gateway.submitFullRefund(refund), 'completed')
  assert.deepEqual(calls.map(([method, path]) => [method, path]), [
    ['GET', '/v3/subscriptions/sub_original/payments?limit=100&offset=0'],
    ['GET', '/v3/subscriptions/sub_original'],
    ['DELETE', '/v3/subscriptions/sub_original'],
    ['POST', '/v3/payments/pay_first/refund'],
    ['GET', '/v3/payments/pay_first'],
  ])
  assert.equal(Object.keys(calls[3][2]).length, 0)
})

test('refuses mismatched customer or payment amount when verifying a charge', async () => {
  const wrongCustomer = new AsaasWithdrawalGateway({ request: async () => ({ ...initial, customer: 'cus_other' }) })
  const match = { ...scope, paymentId: initial.id, amountCents: 1990 }
  await assert.rejects(wrongCustomer.getRefundState(match), { statusCode: 409 })
  const wrongAmount = new AsaasWithdrawalGateway({ request: async () => ({ ...initial, value: 18.9 }) })
  await assert.rejects(wrongAmount.getRefundState(match), { statusCode: 409 })
})

test('a disputed first charge cannot be replaced with a later monthly charge', async () => {
  const disputed = { ...initial, status: 'CHARGEBACK_DISPUTE' }
  const gateway = new AsaasWithdrawalGateway({
    async request(_method, path) {
      if (path.includes('/payments?')) {
        return { offset: 0, hasMore: false, data: [
          { ...initial, id: 'pay_later', dueDate: '2026-12-22' }, disputed,
        ] }
      }
      return disputed
    },
  })
  const first = await gateway.findFirstPayment(scope)
  assert.equal(first.paymentId, initial.id)
  assert.equal(await gateway.getRefundState({ ...scope, ...first }), 'needs_reconciliation')
})

test('a competing stop uses only reads while the executor holding the claim finishes the DELETE', async () => {
  const deleting = Promise.withResolvers()
  const finishDelete = Promise.withResolvers()
  const methods = []
  let deleted = false
  let claimed = false
  const gateway = new AsaasWithdrawalGateway({
    async request(method, path) {
      assert.equal(path, `/v3/subscriptions/${scope.subscriptionId}`)
      methods.push(method)
      if (method === 'DELETE') {
        deleting.resolve()
        await finishDelete.promise
        deleted = true
        return { id: scope.subscriptionId, deleted }
      }
      assert.equal(method, 'GET')
      return { id: scope.subscriptionId, customer: scope.customerId, deleted }
    },
  })
  const claim = async () => {
    if (claimed) return false
    claimed = true
    return true
  }
  const first = gateway.stopSubscription(scope, claim)
  try {
    await Promise.race([deleting.promise, first])
    assert.equal(await gateway.stopSubscription(scope, claim), false)
    assert.deepEqual(methods, ['GET', 'DELETE', 'GET', 'GET'])
  } finally {
    finishDelete.resolve()
  }
  assert.equal(await first, true)
  assert.equal(await gateway.stopSubscription(scope, async () => assert.fail('already removed')), true)
  assert.deepEqual(methods, ['GET', 'DELETE', 'GET', 'GET', 'GET'])
})

test('a lost DELETE response can be reconciled without sending another DELETE', async () => {
  const methods = []
  let deleted = false
  let claimed = false
  const gateway = new AsaasWithdrawalGateway({
    async request(method) {
      methods.push(method)
      if (method === 'DELETE') throw new Error('response lost')
      assert.equal(method, 'GET')
      return { id: scope.subscriptionId, customer: scope.customerId, deleted }
    },
  })
  const claim = async () => {
    if (claimed) return false
    claimed = true
    return true
  }
  await assert.rejects(gateway.stopSubscription(scope, claim), { statusCode: 502 })
  assert.equal(await gateway.stopSubscription(scope, claim), false)
  deleted = true
  assert.equal(await gateway.stopSubscription(scope, async () => assert.fail('already removed')), true)
  assert.deepEqual(methods, ['GET', 'DELETE', 'GET', 'GET', 'GET', 'GET'])
})

test('a lost reply is accepted only after the exact subscription is verified as removed', async () => {
  let deleted = false
  const methods = []
  const gateway = new AsaasWithdrawalGateway({
    async request(method) {
      methods.push(method)
      if (method === 'DELETE') {
        deleted = true
        throw new Error('response lost after deletion')
      }
      return { id: scope.subscriptionId, customer: scope.customerId, deleted }
    },
  })
  assert.equal(await gateway.stopSubscription(scope, async () => true), true)
  assert.deepEqual(methods, ['GET', 'DELETE', 'GET'])
})

test('an unknown subscription or broken ownership check never consumes the deletion claim', async () => {
  for (const [retrieve, statusCode] of [
    [() => { throw new PaymentApiError(404, 'Not found') }, 404],
    [() => ({ id: scope.subscriptionId, customer: 'cus_other', deleted: false }), 409],
    [() => ({ id: scope.subscriptionId, customer: scope.customerId }), 502],
  ]) {
    const gateway = new AsaasWithdrawalGateway({
      async request(method) { assert.equal(method, 'GET'); return retrieve() },
    })
    await assert.rejects(
      gateway.stopSubscription(scope, async () => assert.fail('must verify ownership before claiming')),
      { statusCode },
    )
  }
})
