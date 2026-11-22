import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

const subscriptionId = 'sub_fixture'
const customerId = 'cus_fixture'
const subscriptionPath = `/v3/subscriptions/${subscriptionId}`
const context = {
  customerId,
  currentPeriodEnd: '2027-03-22T15:00:00.000Z',
  isExperimental: false,
}

class FixedDate extends Date {
  constructor(...args) {
    super(...(args.length ? args : ['2026-11-22T15:00:00.000Z']))
  }
}

const { AsaasGateway } = loadTypescriptModule('src/modules/payments/gateway/asaas.gateway.ts', {}, {
  Date: FixedDate,
  process: { env: { ASAAS_WEBHOOK_TOKEN: 'sandbox-test-token' } },
})

function invoice(id, date, status, overrides = {}) {
  return {
    id,
    subscription: subscriptionId,
    customer: customerId,
    dueDate: date,
    originalDueDate: date,
    status,
    deleted: false,
    ...overrides,
  }
}

function fixture(opts = {}) {
  const sub = {
    id: subscriptionId,
    customer: customerId,
    cycle: 'MONTHLY',
    status: 'ACTIVE',
    nextDueDate: '2027-03-22',
    endDate: null,
    deleted: false,
    ...opts.subscription,
  }
  const rows = opts.payments ?? [
    invoice('pay_future_feb', '2027-02-22', 'PENDING'),
    invoice('pay_future_jan', '2027-01-22', 'PENDING'),
    invoice('pay_future_dec', '2026-12-22', 'PENDING'),
    invoice('pay_shifted_current', '2026-11-22', 'PENDING', { dueDate: '2026-12-24' }),
    invoice('pay_past_due', '2026-10-22', 'OVERDUE'),
    invoice('pay_current', '2026-11-22', 'CONFIRMED'),
  ]
  const requests = []
  const http = {
    async request(method, path, options) {
      requests.push({ method, path, body: options?.body })
      if (path === subscriptionPath) {
        if (method === 'PUT') {
          Object.assign(sub, options.body)
          if (opts.losePutReply) throw new Error('transport failed')
        } else {
          assert.equal(method, 'GET')
        }
        return { ...sub }
      }
      if (path.startsWith(`${subscriptionPath}/payments?`)) {
        assert.equal(method, 'GET')
        const query = new URL(`https://example.invalid${path}`).searchParams
        const offset = Number(query.get('offset'))
        const list = rows.filter((row) => !row.deleted)
        const limit = opts.pageSize ?? 2
        return { offset, totalCount: list.length, hasMore: offset + limit < list.length,
          data: list.slice(offset, offset + limit).map((row) => ({ ...row })) }
      }
      const payment = rows.find((row) => path === `/v3/payments/${row.id}`)
      assert.ok(payment)
      if (method === 'GET') {
        opts.onPaymentRead?.(payment)
        return { ...payment }
      }
      assert.equal(method, 'DELETE')
      assert.ok(['PENDING', 'OVERDUE'].includes(payment.status))
      if (!opts.noDeleteEffect) payment.deleted = true
      if (opts.loseDeleteReply) throw new Error('transport failed')
      return { id: payment.id, deleted: payment.deleted }
    },
  }
  return { gateway: new AsaasGateway(http), sub, rows, requests }
}

function writes(requests) {
  return requests.filter((request) => request.method !== 'GET')
}

test('Asaas renewal cancel keeps the paid cycle and deletes only future unpaid charges across all pages', async () => {
  const { gateway, requests, sub, rows } = fixture()
  const result = await gateway.setSubscriptionCancelAtPeriodEnd(subscriptionId, true, context)

  assert.equal(result.currentPeriodEnd, '2026-12-22T15:00:00.000Z')
  assert.equal(sub.status, 'ACTIVE')
  assert.equal(sub.endDate, '2026-12-21')
  assert.deepEqual(writes(requests).map(({ method, path }) => [method, path]), [
    ['PUT', subscriptionPath],
    ['DELETE', '/v3/payments/pay_future_feb'],
    ['DELETE', '/v3/payments/pay_future_jan'],
    ['DELETE', '/v3/payments/pay_future_dec'],
  ])
  assert.deepEqual(rows.filter((row) => !row.deleted).map((row) => row.id), [
    'pay_shifted_current', 'pay_past_due', 'pay_current',
  ])
  assert.ok(requests.some(({ path }) => path.endsWith('&offset=4')))
})

test('a lost PUT and DELETE response are reconciled before reporting success, and retries are read-only', async () => {
  const { gateway, requests } = fixture({ losePutReply: true, loseDeleteReply: true })
  await gateway.setSubscriptionCancelAtPeriodEnd(subscriptionId, true, context)
  const count = requests.length
  assert.equal(writes(requests).length, 4)
  await gateway.setSubscriptionCancelAtPeriodEnd(subscriptionId, true, context)
  assert.equal(writes(requests.slice(count)).length, 0)
})

test('a lost DELETE with no confirmed effect is not retried blindly', async () => {
  const { gateway, requests } = fixture({ loseDeleteReply: true, noDeleteEffect: true })
  await assert.rejects(
    gateway.setSubscriptionCancelAtPeriodEnd(subscriptionId, true, context),
    { statusCode: 503 },
  )
  assert.equal(writes(requests).filter(({ method }) => method === 'DELETE').length, 1)
})

test('Asaas cancel protects an invoice that settled before its fresh status check', async () => {
  const { gateway, requests, rows } = fixture({
    onPaymentRead(payment) {
      if (payment.id === 'pay_future_dec') payment.status = 'CONFIRMED'
    },
  })
  const result = await gateway.setSubscriptionCancelAtPeriodEnd(subscriptionId, true, context)

  assert.equal(result.currentPeriodEnd, '2027-01-22T15:00:00.000Z')
  assert.ok(!writes(requests).some(({ path }) => path === '/v3/payments/pay_future_dec'))
  assert.equal(rows.find(({ id }) => id === 'pay_future_dec').deleted, false)
})

test('foreign subscription payments prevent any financial mutation', async () => {
  const { gateway, requests } = fixture({
    payments: [invoice('pay_other', '2026-12-22', 'PENDING', { subscription: 'sub_other' })],
  })
  await assert.rejects(
    gateway.setSubscriptionCancelAtPeriodEnd(subscriptionId, true, context),
    { statusCode: 503 },
  )
  assert.equal(writes(requests).length, 0)
})

test('a previous cutoff survives retries after a future renewal invoice becomes overdue', async () => {
  const { gateway, requests, rows } = fixture({
    subscription: { endDate: '2026-11-10' },
    payments: [
      invoice('pay_past_due', '2026-10-11', 'OVERDUE'),
      invoice('pay_renewal_overdue', '2026-11-11', 'OVERDUE'),
      invoice('pay_last_paid', '2026-10-11', 'CONFIRMED'),
    ],
  })
  await gateway.setSubscriptionCancelAtPeriodEnd(subscriptionId, true, context)
  assert.deepEqual(writes(requests).map(({ path }) => path), ['/v3/payments/pay_renewal_overdue'])
  assert.equal(rows.find(({ id }) => id === 'pay_past_due').deleted, false)
})

test('an obsolete cutoff based only on the advanced Asaas cursor is corrected before cleanup', async () => {
  const { gateway, requests, sub } = fixture({
    subscription: { endDate: '2027-03-21' },
  })
  await gateway.setSubscriptionCancelAtPeriodEnd(subscriptionId, true, context)
  assert.equal(sub.endDate, '2026-12-21')
  assert.ok(writes(requests).some(({ path }) => path === '/v3/payments/pay_future_dec'))
})

test('Asaas cancel removes a pending renewal due today when both dates match the paid cycle boundary', async () => {
  const { gateway, requests, rows, sub } = fixture({
    payments: [
      invoice('pay_last_paid', '2026-10-22', 'CONFIRMED'),
      invoice('pay_renewal_today', '2026-11-22', 'PENDING'),
      invoice('pay_rescheduled_during_cleanup', '2026-11-22', 'PENDING'),
      invoice('pay_current_rescheduled', '2026-10-22', 'OVERDUE', { dueDate: '2026-11-22' }),
      invoice('pay_old_debt', '2026-09-22', 'OVERDUE'),
      invoice('pay_next_month', '2026-12-22', 'PENDING'),
    ],
    onPaymentRead(payment) {
      if (payment.id === 'pay_rescheduled_during_cleanup') payment.dueDate = '2026-11-30'
    },
  })
  const result = await gateway.setSubscriptionCancelAtPeriodEnd(subscriptionId, true, context)
  assert.equal(sub.endDate, '2026-11-22')
  assert.equal(result.currentPeriodEnd, '2026-11-22T15:00:00.000Z')
  assert.deepEqual(writes(requests).filter(({ method }) => method === 'DELETE').map(({ path }) => path), [
    '/v3/payments/pay_renewal_today',
    '/v3/payments/pay_next_month',
  ])
  assert.deepEqual(rows.filter((row) => !row.deleted).map((row) => row.id), [
    'pay_last_paid', 'pay_rescheduled_during_cleanup', 'pay_current_rescheduled', 'pay_old_debt',
  ])
})

test('a retry after an inclusive cutoff removes only the proven renewal from the previous day', async () => {
  const { gateway, requests, rows } = fixture({
    subscription: { endDate: '2026-11-21' },
    payments: [
      invoice('pay_last_paid', '2026-10-21', 'CONFIRMED'),
      invoice('pay_cutoff_renewal', '2026-11-21', 'OVERDUE'),
      invoice('pay_old_rescheduled', '2026-10-21', 'OVERDUE', { dueDate: '2026-11-21' }),
      invoice('pay_cutoff_rescheduled', '2026-11-21', 'PENDING', { dueDate: '2026-11-24' }),
    ],
  })
  await gateway.setSubscriptionCancelAtPeriodEnd(subscriptionId, true, context)
  assert.deepEqual(writes(requests).map(({ method, path }) => [method, path]), [
    ['DELETE', '/v3/payments/pay_cutoff_renewal'],
  ])
  assert.deepEqual(rows.filter((row) => !row.deleted).map((row) => row.id), [
    'pay_last_paid', 'pay_old_rescheduled', 'pay_cutoff_rescheduled',
  ])
})

test('the inclusive cutoff is withheld when the Asaas cursor can still issue another charge that day', async () => {
  const { gateway, requests } = fixture({
    subscription: { nextDueDate: '2026-11-22' },
    payments: [
      invoice('pay_last_paid', '2026-10-22', 'CONFIRMED'),
      invoice('pay_cutoff_renewal', '2026-11-22', 'PENDING'),
    ],
  })
  await assert.rejects(
    gateway.setSubscriptionCancelAtPeriodEnd(subscriptionId, true, context),
    { statusCode: 503 },
  )
  assert.equal(writes(requests).length, 0)
})

test('a local period date alone does not allow deleting an unpaid invoice due today', async () => {
  const { gateway, sub, rows } = fixture({
    payments: [
      invoice('pay_today', '2026-11-22', 'PENDING'),
      invoice('pay_old_debt', '2026-10-22', 'OVERDUE'),
      invoice('pay_next_month', '2026-12-22', 'PENDING'),
    ],
  })
  await gateway.setSubscriptionCancelAtPeriodEnd(subscriptionId, true, {
    ...context,
    currentPeriodEnd: '2026-11-22T15:00:00.000Z',
  })
  assert.equal(sub.endDate, '2026-11-22')
  assert.deepEqual(rows.filter((row) => !row.deleted).map((row) => row.id), ['pay_today', 'pay_old_debt'])
})

test('Asaas reactivation starts at the local paid period boundary and confirms the recurrence', async () => {
  const { gateway, requests } = fixture({
    losePutReply: true,
    subscription: { endDate: '2026-12-21' },
  })
  const cancelContext = { ...context, currentPeriodEnd: '2026-12-22T15:00:00.000Z' }
  await gateway.setSubscriptionCancelAtPeriodEnd(subscriptionId, false, cancelContext)
  await gateway.setSubscriptionCancelAtPeriodEnd(subscriptionId, false, cancelContext)
  assert.equal(writes(requests).length, 1)
  assert.equal(writes(requests)[0].body.nextDueDate, '2026-12-22')
  assert.equal(writes(requests)[0].body.endDate, null)
})

test('Asaas inactivation at a configured cutoff is not a provider deletion', async () => {
  const { gateway, sub } = fixture({ subscription: { endDate: '2026-12-21', status: 'INACTIVE' } })
  const event = { id: 'evt_fixture', subscription: sub, event: 'SUBSCRIPTION_INACTIVATED' }
  const scheduled = await gateway.verifyAndParseWebhook(JSON.stringify(event), 'sandbox-test-token')
  const removed = await gateway.verifyAndParseWebhook(JSON.stringify({ ...event, event: 'SUBSCRIPTION_DELETED' }), 'sandbox-test-token')
  assert.equal(scheduled.kind, 'subscription.updated')
  assert.equal(scheduled.subscription.cancelAtPeriodEnd, true)
  assert.equal(removed.kind, 'subscription.deleted')
})
