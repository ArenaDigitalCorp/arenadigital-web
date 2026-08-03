import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const servicePath = new URL('../src/modules/arenas/services/asaas-baas.service.ts', import.meta.url)
const actionsPath = new URL('../src/modules/arenas/actions/arenaActions.ts', import.meta.url)

test('Asaas BaaS activation provisions and persists an active Pix key', async () => {
  const [service, actions] = await Promise.all([
    readFile(servicePath, 'utf8'),
    readFile(actionsPath, 'utf8'),
  ])

  assert.match(service, /\/v3\/pix\/addressKeys\?limit=100/u)
  assert.match(service, /body: \{ type: 'EVP' \}/u)
  assert.match(service, /status\.toUpperCase\(\) !== 'ACTIVE'/u)
  assert.match(service, /error instanceof AsaasRequestError/u)
  assert.match(service, /const reconciledKeys = await listAsaasPixKeys\(apiKey\)/u)
  assert.match(actions, /approved \? await ensureArenaAsaasPixKey\(arenaId\)/u)
  assert.match(actions, /pix_key: pixKey/u)
})
