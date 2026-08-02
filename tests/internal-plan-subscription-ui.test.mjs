import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('internal arena plan keeps presentation data while staying gateway-free', async () => {
  const getSubscription = await source('src/modules/payments/usecases/get-subscription.usecase.ts')

  assert.match(
    getSubscription,
    /status:\s*hasInternalAccess\s*\?\s*'none'\s*:/u,
    'internal plans must remain gateway-free for payment lifecycle actions'
  )
  assert.doesNotMatch(
    getSubscription,
    /planLabel:\s*hasInternalAccess\s*\?\s*null/u,
    'internal plan label must be returned so the UI does not look like a missing subscription'
  )
  assert.doesNotMatch(
    getSubscription,
    /priceCents:\s*hasInternalAccess\s*\?\s*null/u,
    'internal plan price must be returned for coherent billing presentation'
  )
})

test('subscription page treats internal access as an active internal plan', async () => {
  const page = await source('src/modules/payments/components/SubscriptionPageClient.tsx')

  assert.match(page, /const isInternalSubscription = subscription\.hasInternalAccess/u)
  assert.match(
    page,
    /const hasSubscription =\s*isInternalSubscription \|\| subscription\.status !== 'none'/u
  )
  assert.match(page, /Plano interno ativo/u)
  assert.match(page, /O plano interno não exige cartão cadastrado/u)
  assert.match(
    page,
    /planSelectionEnabled && !isPartnerSubscription && !isInternalSubscription/u,
    'internal plans should not show paid-plan selection as the current billing state'
  )
})
