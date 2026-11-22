import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

const arenaId = 'arena-01'
const customerId = 'cus_01'
const previousId = 'sub_previous'
const checkoutId = 'checkout-01'
const hostedCheckoutUrl = 'https://checkout.example'
const newSubscriptionId = 'sub_checkout'
const paidEvent = {
  kind: 'checkout.paid',
  providerEventId: 'event-paid',
  checkoutId,
  subscriptionId: null,
  customerId,
}

test('Asaas renewal webhook does not finish cancellation before invoices are reconciled', async () => {
  const fixture = createFixture()
  fixture.subscription.cancel_at_period_end = false
  fixture.subscription.current_period_end = '2026-12-22T15:00:00Z'
  fixture.gateway.retrieveSubscription = async (id) => ({
    id, customerId, status: 'active', cancelAtPeriodEnd: true,
    primaryItem: { currentPeriodEndIso: '2027-03-22T15:00:00Z' },
  })
  const response = await fixture.receive({
    kind: 'subscription.updated',
    providerEventId: 'event-renewal-cancel',
    subscription: { id: previousId, customerId, status: 'active', cancelAtPeriodEnd: false },
  })
  assert.equal(response.status, 200)
  assert.equal(fixture.subscription.cancel_at_period_end, false)
  assert.equal(fixture.subscription.current_period_end, '2026-12-22T15:00:00Z')
})

test('Asaas keeps a scheduled paid period when an older payment failure arrives', async () => {
  const fixture = createFixture()
  fixture.subscription.cancel_at_period_end = true
  fixture.subscription.current_period_end = '2026-12-22T15:00:00Z'
  fixture.gateway.retrieveSubscription = async (id) => ({
    id, customerId, status: 'active', cancelAtPeriodEnd: true,
    primaryItem: { currentPeriodEndIso: '2027-03-22T15:00:00Z' },
  })
  const response = await fixture.receive({
    kind: 'invoice.payment_failed',
    providerEventId: 'event-canceled-invoice-delayed-failure',
    subscriptionId: previousId,
    invoice: { id: 'pay_fixture', attemptCount: 0 },
  })
  assert.equal(response.status, 200)
  assert.equal(fixture.subscription.status, 'active')
  assert.equal(fixture.subscription.current_period_end, '2026-12-22T15:00:00Z')
})

function createFixture({ existingSubscription = true } = {}) {
  const tables = {
    arena_subscriptions: existingSubscription ? [{
      arena_id: arenaId,
      gateway_customer_id: customerId,
      gateway_subscription_id: previousId,
      plan_key: 'max',
      plan_id: 'plan-max',
      status: 'active',
    }] : [],
    arenas: [{ id: arenaId, cpf_cnpj: '01234567890' }],
    payment_checkout_attempts: [],
    payment_webhook_events: [],
  }
  let operation
  let operationCount = 0

  async function rpc(name, args) {
    const result = (data) => ({ data, error: null })
    const subscription = tables.arena_subscriptions.find((row) => row.arena_id === arenaId)

    if (name === 'claim_asaas_subscription_checkout') {
      assert.equal(args.p_arena_id, arenaId)
      const attempt = tables.payment_checkout_attempts.find((row) => row.checkout_id === operation?.checkoutId)
      if (operation && (!attempt || !['paid', 'canceled', 'expired'].includes(attempt.status))) {
        if (operation.planKey !== args.p_plan_key || operation.planId !== args.p_plan_id) {
          return result({ state: 'different_plan' })
        }
        if (attempt?.status !== 'created') return result({ state: 'pending' })
        return result({
          state: 'ready', checkout_id: attempt.checkout_id,
          checkout_url: attempt.metadata.checkout_url, gateway_customer_id: attempt.gateway_customer_id,
        })
      }
      operation = {
        id: `9286d730-988e-4bee-b467-${String(++operationCount).padStart(12, '0')}`,
        state: 'prepared',
        planKey: args.p_plan_key,
        planId: args.p_plan_id,
      }
      return result({ state: 'claimed', operation_id: operation.id })
    }

    if (!operation || operation.id !== args.p_operation_id) return result(false)
    if (name === 'start_asaas_subscription_checkout') {
      if (operation.state !== 'prepared') return result(false)
      operation.state = 'sending'
      operation.customerId = args.p_gateway_customer_id
      operation.previousSubscriptionId = subscription?.gateway_subscription_id ?? null
      if (!subscription) {
        tables.arena_subscriptions.push({
          arena_id: arenaId, status: 'incomplete', plan_key: operation.planKey, plan_id: operation.planId,
          gateway_customer_id: operation.customerId, gateway_subscription_id: null,
        })
      }
      return result(true)
    }
    if (name === 'abandon_asaas_subscription_checkout') {
      const mayAbandon = args.p_definitive_rejection && ['prepared', 'sending'].includes(operation.state)
      if (mayAbandon) operation = undefined
      return result(mayAbandon)
    }
    if (name === 'attach_asaas_subscription_checkout') {
      if (!['sending', 'attached'].includes(operation.state)
        || operation.customerId !== args.p_gateway_customer_id) return result(false)
      if (operation.state === 'attached') return result(operation.checkoutId === args.p_checkout_id)
      operation.state = 'attached'
      operation.checkoutId = args.p_checkout_id
      subscription.gateway_checkout_id = operation.checkoutId
      tables.payment_checkout_attempts.push({
        provider: 'asaas', arena_id: arenaId, checkout_id: operation.checkoutId,
        gateway_customer_id: operation.customerId, plan_key: operation.planKey, plan_id: operation.planId,
        replaces_gateway_subscription_id: operation.previousSubscriptionId,
        result_gateway_subscription_id: null, status: 'created', paid_at: null,
        metadata: { operation_id: operation.id, checkout_url: args.p_checkout_url },
      })
      return result(true)
    }
    assert.fail(`Unexpected RPC ${name}`)
  }

  function from(table) {
    const rows = tables[table]
    const filters = []
    const matches = (row) => filters.every(([key, value]) => row[key] === value)
    let run = () => {
      const row = rows.find(matches)
      return { data: row ? { ...row } : null, error: null }
    }
    const query = {
      eq(key, value) { filters.push([key, value]); return query },
      is(key, value) { return query.eq(key, value) },
      select() { return query },
      maybeSingle() { return Promise.resolve(run()) },
      single() { return query.maybeSingle() },
      then(resolve) { return Promise.resolve(run()).then(resolve) },
      insert(payload) {
        run = () => {
          if (rows.some((row) => row.provider_event_id === payload.provider_event_id)) {
            return { data: null, error: { code: '23505' } }
          }
          const row = { id: payload.provider_event_id, attempts: 1, ...payload }
          rows.push(row)
          return { data: row, error: null }
        }
        return query
      },
      upsert(payload, options) {
        run = () => {
          const keys = options.onConflict.split(',')
          const existing = rows.find((row) => keys.every((key) => row[key] === payload[key]))
          if (!existing) rows.push({ result_gateway_subscription_id: null, paid_at: null, ...payload })
          else if (!options.ignoreDuplicates) Object.assign(existing, payload)
          return { error: null }
        }
        return query
      },
      update(payload) {
        run = () => {
          const row = rows.find(matches)
          if (row) Object.assign(row, payload)
          return { data: row ?? null, error: null }
        }
        return query
      },
    }
    return query
  }

  const canceledSubscriptions = []
  const checkoutRequests = []
  const gateway = {
    providerName: 'asaas',
    webhookSignatureHeader: 'asaas-access-token',
    createCustomer: async () => ({ id: customerId }),
    prepareCardCollection: async (input) => {
      checkoutRequests.push(input)
      return { provider: 'asaas-checkout', checkoutId, checkoutUrl: hostedCheckoutUrl }
    },
    verifyAndParseWebhook: async (body) => JSON.parse(body),
    findSubscriptionIdAfterCheckoutPaid: async (query) => {
      assert.equal(query.checkoutId, checkoutId)
      assert.equal(query.customerId, customerId)
      return newSubscriptionId
    },
    retrieveSubscription: async (id) => ({
      id, customerId, status: 'active', primaryItem: { currentPeriodEndIso: '2030-01-01T00:00:00Z' },
    }),
    cancelSubscriptionImmediately: async (id) => { canceledSubscriptions.push(id) },
  }
  const [setup, webhook, cancellation, { PaymentApiError }] = loadTypescriptModule([
    'src/modules/payments/usecases/create-setup-intent.usecase.ts',
    'src/app/api/payments/webhook/route.ts',
    'src/modules/payments/usecases/cancel-subscription.usecase.ts',
    'src/modules/payments/errors.ts',
  ], {
    '@/lib/supabase-server': { getSupabaseAdmin: () => ({ from, rpc }) },
    '@/lib/observability/server': { observeHttpRequest: () => ({ respond: (res) => res, log() {} }) },
    '@/modules/audit/audit-log.service': { logAuditEvent: async () => {} },
    '@/modules/payments/gateway': { getPaymentGateway: () => gateway },
    '@/modules/payments/gateway/asaas.gateway': { AsaasGateway: class {} },
    '@/modules/payments/repositories/subscription-plans.repository': {
      fetchPlanByKey: async (key) => ({ key, id: `plan-${key}`, label: key, price_cents: 19900 }),
    },
    '@/modules/payments/usecases/sync-arena-billing-snapshot.usecase': {
      syncArenaBillingSnapshotFromGateway: async () => {},
    },
    'next/server': { NextResponse: Response },
  }, { process: { env: { NEXT_PUBLIC_APP_URL: 'https://arena.example' } } })

  return {
    gateway, tables, canceledSubscriptions, checkoutRequests, PaymentApiError,
    get subscription() { return tables.arena_subscriptions[0] },
    startCheckout: (plan = 'pro') => setup.createSetupIntent(arenaId, plan, 'owner@example.com'),
    cancelRenewal: () => cancellation.cancelSubscription(arenaId),
    receive: (event) => webhook.POST(new Request('https://arena.example/api/payments/webhook', {
      method: 'POST',
      headers: { 'asaas-access-token': 'test-token' },
      body: JSON.stringify(event),
    })),
  }
}

test('concurrent requests for the same plan submit one checkout and reopen that session', async () => {
  const fixture = createFixture({ existingSubscription: false })
  const providerEntered = Promise.withResolvers()
  const releaseProvider = Promise.withResolvers()
  const prepare = fixture.gateway.prepareCardCollection
  fixture.gateway.prepareCardCollection = async (input) => {
    const response = await prepare(input)
    providerEntered.resolve()
    await releaseProvider.promise
    return response
  }

  const firstRequest = fixture.startCheckout()
  await Promise.race([firstRequest, providerEntered.promise])
  try {
    await assert.rejects(fixture.startCheckout(), { statusCode: 409, message: /em processamento/ })
    assert.equal(fixture.subscription.status, 'incomplete')
    assert.equal(fixture.subscription.gateway_subscription_id, null)
  } finally {
    releaseProvider.resolve()
  }

  const first = await firstRequest
  const reopened = await fixture.startCheckout()
  assert.deepEqual({ ...reopened.cardCollection }, first.cardCollection)
  assert.equal(reopened.cardCollection.checkoutUrl, hostedCheckoutUrl)
  assert.equal(fixture.checkoutRequests.length, 1)
  assert.equal(fixture.tables.payment_checkout_attempts.length, 1)
})

test('an open checkout blocks creation of a checkout for a different plan', async () => {
  const fixture = createFixture()
  await fixture.startCheckout()

  await assert.rejects(fixture.startCheckout('starter'), { statusCode: 409, message: /outro plano/ })
  assert.equal(fixture.checkoutRequests.length, 1)
  assert.equal(fixture.tables.payment_checkout_attempts[0].plan_key, 'pro')
  assert.equal(fixture.subscription.plan_key, 'max')
})

test('a documented checkout creation rejection permits a new operation', async () => {
  const fixture = createFixture()
  const prepare = fixture.gateway.prepareCardCollection
  fixture.gateway.prepareCardCollection = async (input) => {
    const response = await prepare(input)
    if (fixture.checkoutRequests.length === 1) throw new fixture.PaymentApiError(400, 'Invalid checkout')
    return response
  }

  await assert.rejects(fixture.startCheckout(), { statusCode: 400 })
  assert.equal(fixture.tables.payment_checkout_attempts.length, 0)
  assert.equal((await fixture.startCheckout()).cardCollection.checkoutId, checkoutId)
  const [rejected, accepted] = fixture.checkoutRequests
  assert.notEqual(rejected.idempotencyKey, accepted.idempotencyKey)
  assert.equal(fixture.tables.payment_checkout_attempts.length, 1)
})

test('an ambiguous timeout blocks another POST until checkout.created recovers the session', async () => {
  const fixture = createFixture()
  const prepare = fixture.gateway.prepareCardCollection
  fixture.gateway.prepareCardCollection = async (input) => {
    await prepare(input)
    throw new Error('Checkout response timed out')
  }

  await assert.rejects(fixture.startCheckout(), /timed out/)
  await assert.rejects(fixture.startCheckout(), { statusCode: 409, message: /em processamento/ })
  assert.equal(fixture.checkoutRequests.length, 1)
  assert.equal(fixture.tables.payment_checkout_attempts.length, 0)

  const [request] = fixture.checkoutRequests
  const operationId = request.idempotencyKey
  assert.equal(new URL(request.successUrl).searchParams.get('checkoutOperation'), operationId)
  const createdEvent = {
    kind: 'checkout.created', providerEventId: 'event-created-after-timeout',
    checkoutId, operationId, customerId, checkoutUrl: hostedCheckoutUrl,
  }
  const unrelated = await fixture.receive({
    ...createdEvent, providerEventId: 'event-wrong-customer', customerId: 'cus_other',
  })
  assert.equal(unrelated.status, 200)
  await assert.rejects(fixture.startCheckout(), { statusCode: 409 })
  assert.equal(fixture.tables.payment_checkout_attempts.length, 0)

  assert.equal((await fixture.receive(createdEvent)).status, 200)
  const recovered = await fixture.startCheckout()
  assert.equal(recovered.cardCollection.checkoutId, checkoutId)
  assert.equal(recovered.cardCollection.checkoutUrl, hostedCheckoutUrl)
  assert.equal(fixture.checkoutRequests.length, 1)
  assert.equal(fixture.tables.payment_checkout_attempts.length, 1)
  assert.equal(fixture.subscription.gateway_subscription_id, previousId)
})

test('opening a checkout preserves the active plan until its own payment is confirmed', async () => {
  const fixture = createFixture()
  await fixture.startCheckout()
  assert.equal(fixture.subscription.plan_key, 'max')
  assert.equal(fixture.subscription.plan_id, 'plan-max')
  assert.equal(fixture.subscription.gateway_subscription_id, previousId)

  assert.equal((await fixture.receive(paidEvent)).status, 200)
  assert.equal(fixture.subscription.plan_key, 'pro')
  assert.equal(fixture.subscription.plan_id, 'plan-pro')
  assert.equal(fixture.subscription.gateway_subscription_id, newSubscriptionId)
  assert.deepEqual(fixture.canceledSubscriptions, [previousId])

  const attempt = fixture.tables.payment_checkout_attempts[0]
  const paidAt = attempt.paid_at
  assert.equal(attempt.status, 'paid')
  await fixture.receive({
    ...paidEvent, kind: 'checkout.expired', providerEventId: 'old-expiration',
  })
  assert.equal(attempt.status, 'paid')
  assert.equal(attempt.paid_at, paidAt)
})

test('an unresolved paid checkout can retry without activating or detaching the original plan', async () => {
  const fixture = createFixture()
  await fixture.startCheckout()
  fixture.gateway.findSubscriptionIdAfterCheckoutPaid = async () => null

  assert.equal((await fixture.receive(paidEvent)).status, 500)
  assert.equal(fixture.subscription.plan_key, 'max')
  assert.equal(fixture.subscription.gateway_subscription_id, previousId)
  assert.equal(fixture.canceledSubscriptions.length, 0)

  fixture.gateway.findSubscriptionIdAfterCheckoutPaid = async () => newSubscriptionId
  const deliveries = await Promise.all([fixture.receive(paidEvent), fixture.receive(paidEvent)])
  assert.deepEqual(deliveries.map((response) => response.status), [200, 200])
  assert.equal(fixture.subscription.gateway_subscription_id, newSubscriptionId)
  assert.deepEqual(fixture.canceledSubscriptions, [previousId])
})

test('a second paid checkout and events from a replaced subscription preserve the current plan', async () => {
  const fixture = createFixture()
  await fixture.startCheckout()
  fixture.tables.payment_checkout_attempts.push({
    ...fixture.tables.payment_checkout_attempts[0],
    checkout_id: 'checkout-other',
    plan_key: 'starter',
    plan_id: 'plan-starter',
  })
  await fixture.receive(paidEvent)

  const conflict = await fixture.receive({
    ...paidEvent, providerEventId: 'other-paid', checkoutId: 'checkout-other', subscriptionId: 'sub_other',
  })
  assert.equal(conflict.status, 200)
  const secondAttempt = fixture.tables.payment_checkout_attempts[1]
  assert.equal(secondAttempt.status, 'paid')
  assert.equal(secondAttempt.result_gateway_subscription_id, 'sub_other')
  assert.equal(secondAttempt.metadata.reconciliation_required, 'concurrent_paid_checkout')
  await fixture.receive({
    kind: 'subscription.deleted',
    providerEventId: 'old-deletion',
    subscription: { id: previousId, metadata: { arena_id: arenaId } },
  })
  await fixture.receive({
    kind: 'invoice.refunded',
    providerEventId: 'old-refund',
    subscriptionId: previousId,
    invoice: { id: 'pay_old' },
  })
  assert.equal(fixture.subscription.plan_key, 'pro')
  assert.equal(fixture.subscription.status, 'active')
  assert.equal(fixture.subscription.gateway_subscription_id, newSubscriptionId)
  assert.deepEqual(fixture.canceledSubscriptions, [previousId])
})

test('a delayed checkout cannot activate an already ended subscription', async () => {
  const fixture = createFixture()
  await fixture.startCheckout()
  fixture.gateway.retrieveSubscription = async () => ({
    customerId, status: 'canceled', primaryItem: { currentPeriodEndIso: '2030-01-01T00:00:00Z' },
  })
  assert.equal((await fixture.receive(paidEvent)).status, 500)
  assert.equal(fixture.subscription.gateway_subscription_id, previousId)
  assert.equal(fixture.canceledSubscriptions.length, 0)
})

test('a retry can finish canceling the old recurrence after the paid plan was replaced again', async () => {
  const fixture = createFixture()
  await fixture.startCheckout()
  const cancel = fixture.gateway.cancelSubscriptionImmediately
  fixture.gateway.cancelSubscriptionImmediately = async () => { throw new Error('transient provider failure') }
  assert.equal((await fixture.receive(paidEvent)).status, 500)
  assert.equal(fixture.subscription.gateway_subscription_id, newSubscriptionId)

  const newestId = 'sub_newest'
  fixture.subscription.gateway_subscription_id = newestId
  fixture.subscription.plan_key = 'starter'
  fixture.gateway.cancelSubscriptionImmediately = cancel
  assert.equal((await fixture.receive(paidEvent)).status, 200)
  assert.deepEqual(fixture.canceledSubscriptions, [previousId])
  assert.equal(fixture.subscription.gateway_subscription_id, newestId)
  assert.equal(fixture.subscription.plan_key, 'starter')
})

test('canceling renewal for a replaced subscription does not mark the new plan as canceled', async () => {
  const fixture = createFixture()
  fixture.gateway.setSubscriptionCancelAtPeriodEnd = async (id) => {
    assert.equal(id, previousId)
    fixture.subscription.gateway_subscription_id = newSubscriptionId
  }
  await assert.rejects(fixture.cancelRenewal(), { statusCode: 409 })
  assert.equal(fixture.subscription.cancel_at_period_end, undefined)
})

test('Asaas resolves the subscription from checkout payments and distinguishes refund events', async () => {
  const payment = { customer: customerId, checkoutSession: checkoutId, subscription: newSubscriptionId }
  let payments = [payment]
  const { AsaasGateway } = loadTypescriptModule('src/modules/payments/gateway/asaas.gateway.ts', {}, {
    process: { env: { ASAAS_API_KEY: 'test-key', ASAAS_WEBHOOK_TOKEN: 'test-token' } },
    fetch: async (input) => {
      const url = new URL(input)
      assert.equal(url.pathname, '/v3/payments')
      assert.equal(url.searchParams.get('checkoutSession'), checkoutId)
      assert.equal(url.searchParams.get('customer'), customerId)
      return Response.json({ data: payments, hasMore: false })
    },
  })
  const gateway = new AsaasGateway()
  const query = { checkoutId, customerId }
  assert.equal(await gateway.findSubscriptionIdAfterCheckoutPaid(query), newSubscriptionId)
  payments = [...payments, { ...payment, subscription: 'sub_other' }]
  assert.equal(await gateway.findSubscriptionIdAfterCheckoutPaid(query), null)

  for (const [event, kind] of [
    ['PAYMENT_REFUND_IN_PROGRESS', 'unhandled'],
    ['PAYMENT_PARTIALLY_REFUNDED', 'unhandled'],
    ['PAYMENT_REFUNDED', 'invoice.refunded'],
  ]) {
    const payload = {
      id: 'event-01', event,
      payment: { id: 'pay_01', subscription: newSubscriptionId, dateCreated: '2026-11-20', value: 99 },
    }
    assert.equal((await gateway.verifyAndParseWebhook(JSON.stringify(payload), 'test-token')).kind, kind)
  }
})

test('Asaas confirms the exact checkout subscription across pages when the payment index is empty', async () => {
  const matching = { id: newSubscriptionId, customer: customerId, checkoutSession: checkoutId, deleted: false }
  const older = { ...matching, id: previousId, checkoutSession: 'checkout-other' }
  const listQueries = []
  let pages = [older, matching]
  const { AsaasGateway } = loadTypescriptModule('src/modules/payments/gateway/asaas.gateway.ts', {}, {
    process: { env: { ASAAS_API_KEY: 'test-key' } },
    fetch: async (input) => {
      const url = new URL(input)
      assert.equal(url.searchParams.get('customer'), customerId)
      if (url.pathname === '/v3/payments') {
        assert.equal(url.searchParams.get('checkoutSession'), checkoutId)
        return Response.json({ data: [], hasMore: false })
      }
      assert.equal(url.pathname, '/v3/subscriptions')
      const offset = Number(url.searchParams.get('offset'))
      listQueries.push(offset)
      return Response.json({
        offset, hasMore: offset + 1 < pages.length, totalCount: pages.length, data: [pages[offset]],
      })
    },
  })
  const gateway = new AsaasGateway()
  const scope = { checkoutId, customerId }
  assert.equal(await gateway.findSubscriptionIdAfterCheckoutPaid(scope), newSubscriptionId)
  assert.deepEqual(listQueries, [0, 1])

  for (const entries of [
    [older],
    [matching, { ...matching, id: 'sub_duplicate' }],
    [{ ...matching, customer: 'cus_other' }],
    [{ ...matching, checkoutSession: null }],
    [{ ...matching, deleted: true }],
    [older, older, matching],
  ]) {
    pages = entries
    assert.equal(await gateway.findSubscriptionIdAfterCheckoutPaid(scope), null)
  }
})

test('Asaas extracts a checkout operation from a valid callback and builds a hosted fallback', async () => {
  const { AsaasGateway } = loadTypescriptModule('src/modules/payments/gateway/asaas.gateway.ts', {}, {
    process: { env: { ASAAS_ENV: 'sandbox', ASAAS_API_KEY: 'test-key', ASAAS_WEBHOOK_TOKEN: 'test-token' } },
  })
  const gateway = new AsaasGateway()
  const operationId = '9286d730-988e-4bee-b467-000000000001'
  const successUrl = `https://arena.example/dashboard/settings/subscription/${arenaId}/checkout-return?status=success&checkoutOperation=${operationId}`
  const payload = {
    id: 'event-created', event: 'CHECKOUT_CREATED',
    checkout: { id: checkoutId, customer: customerId, link: null, callback: { successUrl } },
  }

  const parsed = await gateway.verifyAndParseWebhook(JSON.stringify(payload), 'test-token')
  assert.equal(parsed.kind, 'checkout.created')
  assert.equal(parsed.providerEventId, payload.id)
  assert.equal(parsed.operationId, operationId)
  assert.equal(parsed.customerId, customerId)
  assert.equal(parsed.checkoutUrl, `https://sandbox.asaas.com/checkoutSession/show?id=${checkoutId}`)

  payload.checkout.link = hostedCheckoutUrl
  payload.checkout.callback.successUrl = `https://arena.example/other-return?checkoutOperation=${operationId}`
  const unrelated = await gateway.verifyAndParseWebhook(JSON.stringify(payload), 'test-token')
  assert.equal(unrelated.operationId, null)
  assert.equal(unrelated.checkoutUrl, hostedCheckoutUrl)
})
