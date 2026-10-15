import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

function httpGateway(existing) {
  const requests = []
  const { AsaasGateway } = loadTypescriptModule('src/modules/payments/gateway/asaas.gateway.ts', {}, {
    process: { env: { ASAAS_BASE_URL: 'https://asaas.invalid', ASAAS_API_KEY: 'fixture-key' } },
    fetch: async (url, init) => {
      requests.push({ method: init.method, url, body: init.body === undefined ? undefined : JSON.parse(init.body) })
      if (init.method === 'GET') return new Response(JSON.stringify({ data: existing ? [{ id: 'customer-fixture', name: 'Fixture' }] : [] }), { status: 200 })
      return new Response('{"id":"customer-fixture"}', { status: 200 })
    },
  })
  return { requests, gateway: new AsaasGateway() }
}

const contact = { name: 'Fixture', email: 'fixture@example.invalid', cpfCnpj: '52998224725', phone: '+55 (48) 99999-9999', metadata: { arena_id: 'arena-fixture' } }

test('Asaas customer HTTP POST and PUT preserve complete formatted CEP and its leading zeros', async () => {
  for (const existing of [false, true]) {
    for (const [postalCode, expected] of [['01.310-000', '01310000'], ['01310-000', '01310000'], [' 01310000 ', '01310000'], ['88.037-395', '88037395'], ['88\u00a0037\u202f395', '88037395']]) {
      const { gateway, requests } = httpGateway(existing)
      assert.equal((await gateway.createCustomer({ ...contact, postalCode })).id, 'customer-fixture')
      const sent = requests.at(-1)
      assert.deepEqual(requests.map(request => request.method), ['GET', existing ? 'PUT' : 'POST'])
      assert.equal(sent.url, 'https://asaas.invalid/v3/customers' + (existing ? '/customer-fixture' : ''))
      assert.equal(sent.body.postalCode, expected)
      assert.equal(sent.body.cpfCnpj, '52998224725')
      assert.equal(sent.body.phone, '48999999999')
    }
  }
})

test('Asaas customer HTTP POST and PUT omit invalid legacy, blank and absent optional CEP', async () => {
  for (const existing of [false, true]) {
    for (const postalCode of ['88x037-395', 'CEP: 88037395', '88/037395', '880373951', '8803739', '---', '', ' \t ', null, undefined]) {
      const { gateway, requests } = httpGateway(existing)
      await gateway.createCustomer({ ...contact, postalCode })
      assert.deepEqual(requests.map(request => request.method), ['GET', existing ? 'PUT' : 'POST'])
      assert.equal('postalCode' in requests.at(-1).body, false, `existing=${existing}/value=${JSON.stringify(postalCode)}`)
      assert.equal(requests.at(-1).body.cpfCnpj, contact.cpfCnpj)
    }
  }
})
