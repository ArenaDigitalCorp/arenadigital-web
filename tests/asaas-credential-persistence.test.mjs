import assert from 'node:assert/strict'
import test from 'node:test'
import { persistCreatedAsaasCredential } from '../src/modules/arenas/services/asaas-credential-persistence.ts'

function flow(failAt) {
  const calls = []
  const step = (name) => async () => {
    calls.push(name)
    if (failAt === name) throw new Error(`${name} failed`)
  }
  return {
    calls,
    steps: {
      bindOwnership: step('ownership'),
      storeRecoveryEnvelope: step('envelope'),
      storeVaultCredentials: step('vault'),
      deleteRecoveryEnvelope: step('cleanup'),
    },
  }
}

test('new subaccount binds ownership before storing a matching recovery envelope', async () => {
  const { calls, steps } = flow()
  assert.deepEqual(await persistCreatedAsaasCredential(steps), { protected: true })
  assert.deepEqual(calls, ['ownership', 'envelope', 'vault', 'cleanup'])
})

test('a failed ownership write never exposes the key to another provisioning claim', async () => {
  const { calls, steps } = flow('ownership')
  const result = await persistCreatedAsaasCredential(steps)
  assert.equal(result.protected, false)
  assert.deepEqual(calls, ['ownership'])
})

test('a failed envelope write falls back to the Vault instead of discarding the one-time key', async () => {
  const { calls, steps } = flow('envelope')
  assert.deepEqual(await persistCreatedAsaasCredential(steps), { protected: true })
  assert.deepEqual(calls, ['ownership', 'envelope', 'vault'])
})

test('a failed Vault write leaves the recovery envelope in place and blocks activation', async () => {
  const { calls, steps } = flow('vault')
  const result = await persistCreatedAsaasCredential(steps)
  assert.equal(result.protected, false)
  assert.deepEqual(calls, ['ownership', 'envelope', 'vault'])
})

test('a failed ownership write stops before all credential writes', async () => {
  const { calls, steps } = flow('ownership')
  steps.storeVaultCredentials = async () => {
    calls.push('vault')
    throw new Error('vault failed')
  }
  const result = await persistCreatedAsaasCredential(steps)
  assert.equal(result.protected, false)
  assert.deepEqual(calls, ['ownership'])
})

test('a cleanup failure does not hide a confirmed Vault write', async () => {
  const { calls, steps } = flow('cleanup')
  const result = await persistCreatedAsaasCredential(steps)
  assert.equal(result.protected, true)
  assert.deepEqual(calls, ['ownership', 'envelope', 'vault', 'cleanup'])
})
