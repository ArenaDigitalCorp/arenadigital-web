import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

const arenaId = 'f2211200-0000-4000-8000-000000000011'
const actorId = 'f2211200-0000-4000-8000-000000000001'
const requestId = 'f2211200-0000-4000-8000-000000000021'
const subscriptionId = 'sub_initial'
const customerId = 'cus_initial'
const paymentId = 'pay_initial'
const checkoutId = 'checkout_initial'
const periodEnd = '2026-12-22T15:00:00.000Z'
const firstInstantOutsideDeadline = '2026-11-28T03:00:00.000Z'

function fixture({ onLookup, onDelete, onStopClaimDenied } = {}) {
  let clock = Date.parse('2026-11-28T02:59:59.999Z')
  let clockAfterPaymentLookup = null
  let request = null
  let stopClaimed = false
  let providerStopped = false
  let providerRefunded = false
  const calls = []
  const lookups = []
  const payment = { amountCents: 1990, state: 'eligible', paymentId, firstPaidAt: '2026-11-20T03:00:00.000Z' }
  const checkoutPaidAt = '2026-11-20T15:30:00.000Z'
  const checkout = { paid_at: checkoutPaidAt, provider: 'asaas', checkout_id: checkoutId }
  const scope = {
    gateway_subscription_id: subscriptionId, gateway_customer_id: customerId, gateway_checkout_id: checkoutId,
    current_period_end: periodEnd, cancel_at_period_end: false, status: 'active', plan_key: 'starter',
  }
  const policy = {
    state: 'candidate', checkout_id: checkoutId, checkout_paid_at: checkoutPaidAt,
    gateway_customer_id: customerId, gateway_subscription_id: subscriptionId,
  }
  class ControlledDate extends Date { static now() { return clock } }
  const success = data => ({ data, error: null })

  const db = {
    from(table) {
      const query = {
        select: () => query, eq: () => query, order: () => query, limit: () => query,
        maybeSingle: async () => success(table === 'arena_subscriptions' ? scope : checkout),
      }
      return query
    },
    async rpc(method, args) {
      if (method === 'get_arena_subscription_withdrawal_policy') return success(policy)
      calls.push([method, args])
      switch (method) {
        case 'decide_arena_subscription_withdrawal_automatically':
          if (request) return success({ state: 'approved', request: { ...request } })
          if (clock >= Date.parse(firstInstantOutsideDeadline)) {
            return success({ state: 'outside_window', request: null })
          }
          request = {
            id: requestId, status: 'processing', requested_at: new Date(clock).toISOString(), amount_cents: payment.amountCents,
            arena_id: arenaId, provider: 'asaas', gateway_customer_id: customerId, gateway_subscription_id: subscriptionId,
            gateway_payment_id: paymentId, renewal_stopped_at: null, refund_requested_at: null, first_paid_at: payment.firstPaidAt,
          }
          return success({ state: 'approved', request: { ...request } })
        case 'claim_arena_subscription_withdrawal_stop': {
          const deleteAllowed = !stopClaimed
          stopClaimed = true
          return success({ delete_allowed: deleteAllowed })
        }
        case 'record_arena_subscription_withdrawal_renewal_stopped':
          scope.status = 'canceled'
          request.renewal_stopped_at = new Date(clock).toISOString()
          return success(true)
        case 'claim_arena_subscription_withdrawal_refund':
          if (request.refund_requested_at) return success({ post_allowed: false })
          request.status = 'refund_pending'
          request.refund_requested_at = new Date(clock).toISOString()
          return success({ post_allowed: true })
        case 'complete_arena_subscription_withdrawal':
          request.status = 'completed'
          return success(true)
        case 'escalate_arena_subscription_withdrawal':
          request.status = 'escalated'
          return success(true)
        case 'list_arena_subscription_withdrawals_for_review':
          return success([{ ...request }])
        case 'request_arena_subscription_withdrawal':
          request = { id: requestId, status: 'awaiting_review', requested_at: new Date(clock).toISOString(), amount_cents: null }
          return success(request)
        default: assert.fail('unexpected RPC ' + method)
      }
    },
  }

  const { actOnSubscriptionWithdrawal, subscriptionWithdrawalForArena } = loadTypescriptModule('src/modules/payments/usecases/subscription-withdrawal.usecase.ts', {
    '@/lib/supabase-server': { getSupabaseAdmin: () => db },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => ({ rpc: async () => success(request) }) },
    '@/modules/payments/gateway/asaas-withdrawal': {
      AsaasWithdrawalGateway: class {
        async findConfirmedCheckoutPayment(input) {
          lookups.push(input)
          if (clockAfterPaymentLookup !== null) {
            clock = clockAfterPaymentLookup
            clockAfterPaymentLookup = null
          }
          await onLookup?.()
          return payment
        }
        async getRefundState() { return providerRefunded ? 'completed' : 'eligible' }
        async stopSubscription(_scope, claimDelete) {
          if (providerStopped) return true
          if (!await claimDelete()) {
            onStopClaimDenied?.()
            return providerStopped
          }
          calls.push(['asaas.stop'])
          await onDelete?.()
          providerStopped = true
          return true
        }
        async submitFullRefund() {
          calls.push(['asaas.refund'])
          providerRefunded = true
          return 'completed'
        }
      },
    },
  }, { Date: ControlledDate })

  return {
    calls, lookups, scope, payment, policy, checkout,
    advance: date => { clock = Date.parse(date) },
    advanceDuringNextPaymentLookup: date => { clockAfterPaymentLookup = Date.parse(date) },
    observeProviderRemoval: () => { providerStopped = true },
    preview: () => subscriptionWithdrawalForArena(arenaId, actorId),
    resume: () => actOnSubscriptionWithdrawal({ reviewerAuthId: actorId, requestId, action: 'resume', reason: 'reconciliation' }),
    confirm: token => subscriptionWithdrawalForArena(arenaId, actorId, {
      token,
      cancelRenewal: async expected => {
        assert.equal(expected.subscriptionId, subscriptionId)
        assert.equal(expected.currentPeriodEnd, periodEnd)
        calls.push(['renewal'])
        scope.cancel_at_period_end = true
        return { currentPeriodEnd: periodEnd }
      },
    }),
  }
}

test('one confirmation on day seven stops the Asaas subscription and refunds the original amount once', async () => {
  const f = fixture()
  const quote = await f.preview()
  assert.equal(quote.mode, 'withdrawal')
  assert.equal(quote.deadlineAt, '2026-11-28T02:59:59.999Z')
  assert.equal(quote.refundAmountCents, 1990)
  assert.equal(f.calls.length, 0)
  const result = await f.confirm(quote.confirmation)
  assert.equal(result.request.status, 'completed')
  assert.equal(result.request.refundAmountCents, 1990)
  assert.equal(f.scope.status, 'canceled')
  assert.equal((await f.confirm(quote.confirmation)).request.id, requestId)
  assert.deepEqual(f.calls.map(([method]) => method), [
    'decide_arena_subscription_withdrawal_automatically', 'claim_arena_subscription_withdrawal_stop',
    'asaas.stop', 'record_arena_subscription_withdrawal_renewal_stopped',
    'claim_arena_subscription_withdrawal_refund', 'asaas.refund', 'complete_arena_subscription_withdrawal',
  ])
})

test('two simultaneous confirmations share one protocol and issue only one stop and one refund', { timeout: 3000 }, async () => {
  let overlap = false
  let readers = 0
  const bothRead = Promise.withResolvers()
  const loserSawActive = Promise.withResolvers()
  const finishDelete = Promise.withResolvers()
  const f = fixture({
    onLookup: async () => {
      if (!overlap) return
      readers += 1
      if (readers === 2) bothRead.resolve()
      await bothRead.promise
    },
    onDelete: () => finishDelete.promise,
    onStopClaimDenied: () => loserSawActive.resolve(),
  })
  const quote = await f.preview()
  overlap = true
  const confirmations = [f.confirm(quote.confirmation), f.confirm(quote.confirmation)]
  try {
    await Promise.race([loserSawActive.promise, ...confirmations])
    const first = await Promise.race(confirmations)
    assert.equal(first.request.id, requestId)
    assert.equal(first.request.status, 'processing')
    assert.equal(f.calls.filter(([name]) => name === 'claim_arena_subscription_withdrawal_stop').length, 2)
    assert.equal(f.calls.filter(([name]) => name === 'asaas.stop').length, 1)
    assert.equal(f.calls.some(([name]) => ['asaas.refund', 'escalate_arena_subscription_withdrawal'].includes(name)), false)
  } finally {
    finishDelete.resolve()
  }
  const results = await Promise.all(confirmations)
  assert.deepEqual(results.map(result => result.request.id), [requestId, requestId])
  assert.equal((await f.preview()).request.status, 'completed')
  for (const method of ['asaas.stop', 'asaas.refund', 'complete_arena_subscription_withdrawal']) {
    assert.equal(f.calls.filter(([name]) => name === method).length, 1)
  }
})

test('after a lost stop response, only proof of removal allows the same request to continue', async () => {
  const f = fixture({ onDelete: async () => { throw new Error('lost response') } })
  const quote = await f.preview()
  assert.equal((await f.confirm(quote.confirmation)).request.status, 'escalated')
  assert.equal(f.calls.at(-1)[1].p_error_code, 'withdrawal_stop_not_confirmed')
  await f.resume()
  assert.equal((await f.preview()).request.status, 'escalated')
  assert.equal(f.calls.filter(([name]) => name === 'asaas.stop').length, 1)
  assert.equal(f.calls.some(([name]) => name === 'asaas.refund'), false)
  f.observeProviderRemoval()
  await f.resume()
  assert.equal((await f.preview()).request.status, 'completed')
  assert.equal(f.calls.filter(([name]) => name === 'asaas.stop').length, 1)
  assert.equal(f.calls.filter(([name]) => name === 'asaas.refund').length, 1)
})

test('an expired confirmation cannot silently switch a refund request to renewal cancellation', async () => {
  const f = fixture()
  const before = await f.preview()
  f.advance(firstInstantOutsideDeadline)
  await assert.rejects(f.confirm(before.confirmation), { statusCode: 409, code: 'cancellation_changed' })
  assert.equal(f.calls.length, 0)
  const after = await f.preview()
  assert.equal(after.mode, 'renewal')
  assert.equal(after.refundAmountCents, null)
  const final = await f.confirm(after.confirmation)
  assert.equal(final.currentPeriodEnd, periodEnd)
  assert.equal(f.scope.status, 'active')
  assert.deepEqual(f.calls, [['renewal']])
})

test('a preview uses one policy instant even when the Asaas read crosses the deadline', async () => {
  const f = fixture()
  f.advanceDuringNextPaymentLookup(firstInstantOutsideDeadline)
  const refund = await f.preview()
  assert.equal(refund.mode, 'withdrawal')
  assert.equal(refund.refundAmountCents, 1990)
  assert.equal(f.lookups.length, 1)
  await assert.rejects(f.confirm(refund.confirmation), { statusCode: 409, code: 'cancellation_changed' })
  assert.deepEqual(f.calls, [])
  const renewal = await f.preview()
  assert.equal(renewal.mode, 'renewal')
  assert.equal(renewal.refundAmountCents, null)
  assert.equal(f.lookups.length, 1)
  await f.confirm(renewal.confirmation)
  assert.deepEqual(f.calls, [['renewal']])
})

test('the database deadline prevents both actions if a refund confirmation was received just in time', async () => {
  const f = fixture()
  const refund = await f.preview()
  f.advanceDuringNextPaymentLookup(firstInstantOutsideDeadline)
  await assert.rejects(f.confirm(refund.confirmation), { statusCode: 409, code: 'cancellation_changed' })
  assert.deepEqual(f.calls.map(([method]) => method), ['decide_arena_subscription_withdrawal_automatically'])
  assert.equal(f.calls[0][1].p_gateway_payment_id, paymentId)
  assert.equal(f.calls[0][1].p_amount_cents, 1990)
  assert.equal(f.scope.status, 'active')
  assert.equal(f.scope.cancel_at_period_end, false)
  const again = await f.preview()
  assert.equal(again.mode, 'renewal')
  assert.equal(again.request, null)
})

test('the same renewal offer has a stable confirmation when legacy proof changes its refund evidence', async () => {
  const f = fixture()
  f.advance('2026-11-30T03:00:00.000Z')
  const canonical = await f.preview()
  assert.equal(canonical.mode, 'renewal')
  assert.equal(f.lookups.length, 0)

  f.policy.state = 'unverified'
  delete f.policy.checkout_id
  delete f.policy.checkout_paid_at
  f.checkout.paid_at = '2026-11-21T15:30:00.000Z'
  f.payment.paymentId = 'pay_legacy'
  f.payment.amountCents = 2490
  const legacy = await f.preview()
  assert.equal(legacy.mode, 'renewal')
  assert.notEqual(legacy.deadlineAt, canonical.deadlineAt)
  assert.equal(legacy.refundAmountCents, null)
  assert.equal(legacy.confirmation, canonical.confirmation)
  assert.equal(f.lookups.length, 1)

  f.payment.amountCents = 2590
  assert.equal((await f.confirm(canonical.confirmation)).request, null)
  assert.deepEqual(f.calls, [['renewal']])
})

test('an existing renewal confirmation cannot follow another checkout, customer, subscription or billing period', async () => {
  for (const [field, value] of [
    ['gateway_checkout_id', 'checkout_next'],
    ['gateway_customer_id', 'cus_other'],
    ['gateway_subscription_id', 'sub_other'],
    ['current_period_end', '2027-01-22T15:00:00.000Z'],
  ]) {
    const f = fixture()
    f.advance(firstInstantOutsideDeadline)
    const renewal = await f.preview()
    assert.equal(renewal.mode, 'renewal')
    f.scope[field] = value
    await assert.rejects(f.confirm(renewal.confirmation), { statusCode: 409, code: 'cancellation_changed' })
    assert.deepEqual(f.calls, [])
  }
})

test('a change in the confirmed charge amount asks for a new confirmation', async () => {
  const f = fixture()
  const before = await f.preview()
  f.payment.amountCents = 2000
  await assert.rejects(f.confirm(before.confirmation), { statusCode: 409, code: 'cancellation_changed' })
  assert.equal(f.calls.length, 0)
})

test('a recent replacement or ambiguous origin is reviewed without any Asaas mutation', async () => {
  for (const state of ['continuation', 'unverified']) {
    const f = fixture()
    f.policy.state = state
    const quote = await f.preview()
    assert.equal(quote.mode, 'review')
    const result = await f.confirm(quote.confirmation)
    assert.equal(result.request.status, 'awaiting_review')
    assert.deepEqual(f.calls.map(([method]) => method), ['request_arena_subscription_withdrawal'])
  }
})
