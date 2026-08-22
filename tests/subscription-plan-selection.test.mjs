import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const pagePath = new URL(
  '../src/modules/payments/components/SubscriptionPageClient.tsx',
  import.meta.url
)

test('paid plans start unselected when the current plan is not one of the visible options', async () => {
  const page = await readFile(pagePath, 'utf8')

  assert.match(
    page,
    /useState<UserSelectablePlanKey \| null>[\s\S]{0,180}\? \(initialSubscription\.planKey as UserSelectablePlanKey\)[\s\S]{0,40}: null/
  )
  assert.doesNotMatch(page, /plans\[0\]\?\.key \?\? 'starter'/)
  assert.match(page, /Selecione um plano para continuar\./)
})
