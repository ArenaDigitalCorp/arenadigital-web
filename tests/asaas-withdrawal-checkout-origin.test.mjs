import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

class FixedDate extends Date {
  constructor(...args) {
    super(...(args.length ? args : ['2026-11-22T15:00:00.000Z']))
  }
}

const { AsaasWithdrawalGateway } = loadTypescriptModule('src/modules/payments/gateway/asaas-withdrawal.ts', {}, { Date: FixedDate })
const scope = { checkoutId: 'a8e46d18-2590-4a20-a2b9-c6ca568990ce', subscriptionId: 'sub_original', customerId: 'cus_original' }
const original = {
  id: 'pay_checkout', checkoutSession: scope.checkoutId, customer: scope.customerId,
  subscription: scope.subscriptionId, billingType: 'CREDIT_CARD', value: 19.90, deleted: false,
  status: 'CONFIRMED', confirmedDate: '2026-11-22', clientPaymentDate: '2026-11-23', paymentDate: '2026-12-22',
  dueDate: '2026-11-22', originalDueDate: '2026-11-22',
}
const future = {
  ...original, id: 'pay_renewal', status: 'PENDING',
  confirmedDate: null, clientPaymentDate: null, paymentDate: null, refunds: null,
  dueDate: '2026-12-22', originalDueDate: '2026-12-22',
}

function fixture(options = {}) {
  const calls = []
  const gateway = new AsaasWithdrawalGateway({
    async request(method, path) {
      calls.push(path)
      assert.equal(method, 'GET')
      if (path.startsWith(`/v3/subscriptions/${scope.subscriptionId}/payments?`)) {
        const params = new URL(`https://example.invalid${path}`).searchParams
        assert.equal(params.get('limit'), '100')
        assert.equal(params.get('offset'), '0')
        return { hasMore: false, offset: 0, totalCount: 1, data: [original], ...options.list }
      }
      const row = (options.list?.data ?? [original]).find(payment => path === `/v3/payments/${payment.id}`)
      assert.ok(row, 'individual lookup must use a listed payment ID')
      return { ...row, ...options.details }
    },
  })
  return { gateway, calls }
}

test('selects only the checkout charge, rereads its scope and returns the card confirmation date', async () => {
  const { gateway, calls } = fixture()
  const exact = await gateway.findConfirmedCheckoutPayment(scope)
  assert.deepEqual({ ...exact }, {
    paymentId: original.id, amountCents: 1990, firstPaidAt: '2026-11-22T03:00:00.000Z', state: 'eligible',
  })
  assert.equal(calls.length, 2)
})

test('an ambiguous or wrong checkout result never falls back to a later subscription invoice', async () => {
  const later = { ...original, id: 'pay_renewal', checkoutSession: null }
  const alternative = { ...later, checkoutSession: scope.checkoutId }
  for (const [list, statusCode] of [
    [{ totalCount: 0, data: [] }, 409],
    [{ totalCount: 2, data: [original, alternative] }, 409],
    [{ offset: 10 }, 503],
    [{ data: [later] }, 409],
    [{ data: [{ ...original, customer: 'cus_other' }] }, 503],
    [{ data: [{ ...original, subscription: 'sub_other' }] }, 503],
  ]) {
    const { gateway, calls } = fixture({ list })
    await assert.rejects(gateway.findConfirmedCheckoutPayment(scope), { statusCode })
    assert.equal(calls.length, 1)
  }
})

test('selects the exact checkout charge alongside later recurring invoices', async () => {
  const later = { ...future, checkoutSession: null }
  const { gateway } = fixture({ list: { totalCount: 2, data: [later, original] } })
  assert.equal((await gateway.findConfirmedCheckoutPayment(scope)).paymentId, original.id)
})

test('ignores charges sharing the checkout only when both dates prove a strictly future unpaid cycle', async () => {
  const next = { ...future, id: 'pay_renewal_next', dueDate: '2027-01-22', originalDueDate: '2027-01-22' }
  const { gateway, calls } = fixture({ list: { totalCount: 3, data: [next, future, original] } })
  const charge = await gateway.findConfirmedCheckoutPayment(scope)
  assert.equal(charge.paymentId, original.id)
  assert.equal(charge.state, 'eligible')
  assert.equal(calls[1], `/v3/payments/${original.id}`)
})

test('another charge sharing the checkout needs review unless dates, status and payment evidence identify a future recurrence', async () => {
  for (const overrides of [
    { status: 'CONFIRMED', confirmedDate: '2026-12-22' },
    { status: 'CHARGEBACK_DISPUTE' },
    { status: 'REFUND_REQUESTED' },
    { status: 'AWAITING_RISK_ANALYSIS' },
    { status: 'OVERDUE' },
    { confirmedDate: '2026-11-22' },
    { clientPaymentDate: '2026-11-22' },
    { paymentDate: '2026-11-22' },
    { refunds: [{ status: 'DONE', value: 19.9 }] },
    { dueDate: '2026-11-22' },
    { originalDueDate: '2026-11-21' },
    { originalDueDate: null },
    { dueDate: '2027-02-30' },
    { billingType: 'PIX' },
    { deleted: true },
  ]) {
    const other = { ...future, ...overrides }
    const { gateway } = fixture({ list: { totalCount: 2, data: [other, original] } })
    await assert.rejects(gateway.findConfirmedCheckoutPayment(scope), { statusCode: 409 })
  }
})

test('a later paid charge does not replace an earlier pending original', async () => {
  const unpaidOriginal = { ...original, status: 'PENDING', confirmedDate: null, clientPaymentDate: null, paymentDate: null }
  const paidRenewal = { ...future, status: 'CONFIRMED', confirmedDate: '2026-12-22' }
  const { gateway } = fixture({ list: { totalCount: 2, data: [paidRenewal, unpaidOriginal] } })
  await assert.rejects(gateway.findConfirmedCheckoutPayment(scope), { statusCode: 409 })
})

test('the individual charge lookup must prove session, owner, value, card and confirmation date', async () => {
  for (const details of [
    { id: 'pay_other' }, { checkoutSession: null }, { customer: 'cus_other' },
    { subscription: 'sub_other' }, { billingType: 'PIX' }, { value: 19.89 }, { deleted: true },
    { status: 'PENDING' }, { confirmedDate: null }, { confirmedDate: '2026-02-31' },
  ]) {
    const { gateway } = fixture({ details })
    await assert.rejects(gateway.findConfirmedCheckoutPayment(scope), { statusCode: 409 })
  }
})

test('refund evidence is read from the latest charge and is tied to the full paid amount', async () => {
  const paid = { status: 'REFUNDED', refunds: [{ status: 'DONE', value: 19.90 }] }
  const partial = { status: 'REFUNDED', refunds: [{ status: 'DONE', value: 5.00 }] }
  const pending = { status: 'REFUND_IN_PROGRESS', refunds: [{ status: 'PENDING', value: 19.90 }] }
  for (const [details, state] of [[paid, 'completed'], [partial, 'needs_reconciliation'], [pending, 'pending']]) {
    const { gateway } = fixture({ details })
    const charge = await gateway.findConfirmedCheckoutPayment(scope)
    assert.equal(charge.state, state)
  }
})
