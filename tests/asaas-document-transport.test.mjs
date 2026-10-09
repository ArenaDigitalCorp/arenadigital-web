import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

function harness(fetchImpl, credentialError = null) {
  const credentialCalls = []
  const requests = []
  const { createArenaAsaasDocumentTransport } = loadTypescriptModule(
    'src/modules/arenas/services/asaas-document-transport.ts', {
      'server-only': {},
      '@/modules/arenas/services/asaas-baas.service': {
        async loadSubaccountApiKey(arenaId) {
          credentialCalls.push(arenaId)
          if (credentialError) throw credentialError
          return 'synthetic-subaccount-test-only'
        },
        asaasBaseUrl: () => 'https://api-sandbox.asaas.com',
      },
    }, {
      fetch: async (url, options) => {
        requests.push({ url, options })
        return fetchImpl(url, options)
      },
    },
  )
  return { create: createArenaAsaasDocumentTransport, requests, credentialCalls }
}

const upload = {
  groupId: 'group-test', type: 'IDENTIFICATION',
  bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
  mimeType: 'application/pdf', filename: 'document.pdf',
}

test('provider document lookup uses only the requested arena credential and no cached data', async () => {
  const h = harness(() => Response.json({ data: [{ id: 'group-test', type: 'IDENTIFICATION', status: 'NOT_SENT' }] }))
  const transport = await h.create('arena-test')
  const groups = await transport.list()
  assert.equal(groups[0].canUpload, true)
  assert.deepEqual(h.credentialCalls, ['arena-test'])
  const [request] = h.requests
  assert.equal(request.url, 'https://api-sandbox.asaas.com/v3/myAccount/documents')
  assert.equal(request.options.headers.access_token, 'synthetic-subaccount-test-only')
  assert.equal(request.options.cache, 'no-store')
  assert.equal(request.options.redirect, 'error')
  assert.ok(request.options.signal instanceof AbortSignal)
})

test('API document upload sends actual multipart fields with a safe filename and no manual Content-Type', async () => {
  const h = harness(() => new Response(null, { status: 200 }))
  const transport = await h.create('arena-test')
  await transport.upload(upload)
  const [{ url, options }] = h.requests
  assert.equal(url, 'https://api-sandbox.asaas.com/v3/myAccount/documents/group-test')
  assert.equal(options.method, 'POST')
  assert.equal(options.headers['Content-Type'], undefined)
  assert.equal(options.headers['content-type'], undefined)
  assert.equal(options.body.get('type'), 'IDENTIFICATION')
  const part = options.body.get('documentFile')
  assert.equal(part.name, 'document.pdf')
  assert.equal(part.type, 'application/pdf')
  assert.deepEqual(new Uint8Array(await part.arrayBuffer()), upload.bytes)
  assert.equal(options.redirect, 'error')
  assert.equal(options.cache, 'no-store')
})

test('provider group IDs are URL encoded and cannot change the upload endpoint', async () => {
  const h = harness(() => new Response(null, { status: 200 }))
  await (await h.create('arena-test')).upload({ ...upload, groupId: 'synthetic/test?other=true' })
  assert.equal(h.requests[0].url, 'https://api-sandbox.asaas.com/v3/myAccount/documents/synthetic%2Ftest%3Fother%3Dtrue')
})

for (const [status, outcome, reasonCode] of [
  [400, 'failed', 'provider_rejected'],
  [401, 'failed', 'provider_unauthorized'],
  [403, 'failed', 'provider_unauthorized'],
  [404, 'failed', 'provider_not_found'],
  [422, 'failed', 'provider_rejected'],
  [429, 'failed', 'rate_limited'],
  [500, 'unknown', 'response_unknown'],
  [503, 'unknown', 'response_unknown'],
]) {
  test(`provider HTTP ${status} has a safe durable ${outcome} outcome without echoing its response`, async () => {
    const h = harness(() => Response.json({ errors: [{ description: 'synthetic-private-provider-detail', code: 'private-test' }] }, { status }))
    await assert.rejects((await h.create('arena-test')).upload(upload), error => {
      assert.equal(error.outcome, outcome)
      assert.equal(error.reasonCode, reasonCode)
      assert.ok(!error.message.includes('synthetic-private'))
      assert.equal(error.payload, undefined)
      return true
    })
  })
}

test('an interrupted upload has an unknown outcome and cannot be described as a definite rejection', async () => {
  const h = harness(() => { throw new Error('synthetic-private-transport-detail') })
  await assert.rejects((await h.create('arena-test')).upload(upload), error => {
    assert.equal(error.outcome, 'unknown')
    assert.equal(error.reasonCode, 'transport_unknown')
    assert.equal(error.code, 'upload_result_unknown')
    assert.ok(!error.message.includes('synthetic-private'))
    return true
  })
})

test('credential lookup failures are sanitized before any provider request', async () => {
  const h = harness(() => { throw new Error('Must not send request') }, new Error('synthetic-private-credential-detail'))
  await assert.rejects(h.create('arena-test'), error => {
    assert.equal(error.status, 503)
    assert.equal(error.code, 'document_access_unavailable')
    assert.ok(!error.message.includes('synthetic-private'))
    return true
  })
  assert.equal(h.requests.length, 0)
})

test('malformed and oversized document responses are rejected without retaining provider content', async () => {
  for (const body of ['synthetic-not-json', JSON.stringify({ data: [], ignored: 'x'.repeat(256 * 1024) })]) {
    const h = harness(() => new Response(body))
    await assert.rejects((await h.create('arena-test')).list(), error => {
      assert.equal(error.status, 502)
      assert.ok(['invalid_document_list', 'document_list_limit'].includes(error.code))
      assert.ok(!error.message.includes('synthetic-not-json'))
      return true
    })
  }
})

test('listing errors do not imply an upload was attempted', async () => {
  const h = harness(() => { throw new Error('synthetic-private-network-error') })
  await assert.rejects((await h.create('arena-test')).list(), { code: 'document_list_unavailable' })
  assert.equal(h.requests.length, 1)
  assert.equal(h.requests[0].options.method, undefined)
})

test('a generic provider rejection does not blame file format and retains only safe diagnostics', async () => {
  const h = harness(() => Response.json({ errors: [
    { code: 'invalid_action', description: 'synthetic-private-provider-detail' },
    { code: 'synthetic-private-unknown-code', description: 'synthetic-private-file-name.pdf' },
  ] }, { status: 400 }))
  await assert.rejects((await h.create('arena-test')).upload(upload), error => {
    assert.equal(error.outcome, 'failed')
    assert.equal(error.reasonCode, 'provider_rejected')
    assert.equal(error.providerHttpStatus, 400)
    assert.deepEqual(Array.from(error.providerErrorCodes), ['invalid_action', 'unclassified'])
    assert.ok(!/formato|extens[aã]o/iu.test(error.message))
    assert.ok(!JSON.stringify(error).includes('synthetic-private'))
    assert.ok(!error.message.includes('synthetic-private'))
    return true
  })
})

test('malformed, HTML, absent and oversized error bodies preserve a definite HTTP rejection', async () => {
  for (const body of [null, 'synthetic-not-json', '<html>synthetic-private-error</html>', JSON.stringify({ errors: [{ code: 'invalid_action', description: 'x'.repeat(300 * 1024) }] })]) {
    const h = harness(() => new Response(body, { status: 422 }))
    await assert.rejects((await h.create('arena-test')).upload(upload), error => {
      assert.equal(error.outcome, 'failed')
      assert.equal(error.providerHttpStatus, 422)
      assert.deepEqual(Array.from(error.providerErrorCodes), ['unclassified'])
      assert.ok(!/formato/iu.test(error.message))
      assert.ok(!JSON.stringify(error).includes('synthetic-private'))
      return true
    })
  }
})

test('a body-read failure does not turn a received 400 rejection into unknown', async () => {
  const h = harness(() => new Response(new ReadableStream({ start(controller) { controller.error(new Error('synthetic-private-stream-detail')) } }), { status: 400 }))
  await assert.rejects((await h.create('arena-test')).upload(upload), error => {
    assert.equal(error.outcome, 'failed')
    assert.equal(error.reasonCode, 'provider_rejected')
    assert.deepEqual(Array.from(error.providerErrorCodes), ['unclassified'])
    assert.ok(!error.message.includes('synthetic-private'))
    return true
  })
})

test('provider error-code diagnostics are bounded and deduplicated', async () => {
  const h = harness(() => Response.json({ errors: Array.from({ length: 100 }, () => ({ code: 'invalid_action', description: 'synthetic-private-detail' })) }, { status: 400 }))
  await assert.rejects((await h.create('arena-test')).upload(upload), error => {
    assert.deepEqual(Array.from(error.providerErrorCodes), ['invalid_action'])
    assert.equal(error.providerHttpStatus, 400)
    return true
  })
})

test('an explicit API-method refusal has a fixed support instruction without leaking the provider description', async () => {
  const h = harness(() => Response.json({ errors: [{ code: 'invalid_object',
    description: 'Esse tipo de documento não pode ser enviado via API. synthetic-private-provider-detail',
  }] }, { status: 400 }))
  await assert.rejects((await h.create('arena-test')).upload(upload), error => {
    assert.equal(error.status, 409)
    assert.equal(error.code, 'provider_document_api_unavailable')
    assert.equal(error.outcome, 'failed')
    assert.equal(error.reasonCode, 'provider_rejected')
    assert.equal(error.providerHttpStatus, 400)
    assert.deepEqual(Array.from(error.providerErrorCodes), ['invalid_object'])
    assert.match(error.message, /Asaas.*API/u)
    assert.match(error.message, /suporte.*Asaas/u)
    assert.ok(!/formato|extens[aã]o/iu.test(error.message))
    assert.ok(!JSON.stringify(error).includes('synthetic-private'))
    return true
  })
})

test('invalid_object is not interpreted as an API-method refusal without the precise provider reason', async () => {
  for (const [status, code, description, expectedCode] of [
    [400, 'invalid_object', 'synthetic-private-unrelated-reason', 'provider_document_rejected'],
    [400, 'invalid_action', 'Esse tipo de documento não pode ser enviado via API.', 'provider_document_rejected'],
    [503, 'invalid_object', 'Esse tipo de documento não pode ser enviado via API.', 'upload_result_unknown'],
  ]) {
    const h = harness(() => Response.json({ errors: [{ code, description }] }, { status }))
    await assert.rejects((await h.create('arena-test')).upload(upload), error => {
      assert.equal(error.code, expectedCode)
      assert.ok(!error.message.includes('synthetic-private'))
      return true
    })
  }
})
