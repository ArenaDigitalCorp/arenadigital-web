import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const gatePath = new URL(
  '../src/components/dashboard/DashboardSubscriptionGate.tsx',
  import.meta.url
)

test('dashboard shows the experimental period and its expiration state', async () => {
  const gate = await readFile(gatePath, 'utf8')

  assert.match(gate, /subscription\.planKey !== EXPERIMENTAL_PLAN_KEY/)
  assert.match(gate, /resta 1 dia/)
  assert.match(gate, /restam \$\{remainingDays\} dias/)
  assert.match(gate, /Seu Plano Experimental terminou/)
  assert.match(gate, /Conhecer os planos/)
  assert.match(gate, /Escolher um plano/)
})
