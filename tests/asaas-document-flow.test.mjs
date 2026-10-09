import assert from 'node:assert/strict'
import test from 'node:test'
import {
  TEST_ARENA_ID, TEST_FOREIGN_ARENA_ID, TEST_ACTOR_ID, TEST_REQUEST_ID, TEST_SECOND_REQUEST_ID,
  documentFlowHarness, documentInput, uploadRequest, routeContext,
} from './helpers/asaas-document-flow-harness.mjs'

const providerPosts = harness => harness.providerRequests.filter(call => call.request.method === 'POST')
const claims = harness => harness.rpcCalls.filter(call => call.name === 'claim_arena_asaas_document_upload')

test('an API-method refusal reaches the owner as a safe instruction and keeps failed upload retry guards', async () => {
  const h = documentFlowHarness({ uploadStatus: 400, uploadBody: JSON.stringify({ errors: [{
    code: 'invalid_object', description: 'Esse tipo de documento não pode ser enviado via API. synthetic-private-provider-detail',
  }] }) })
  const response = await h.route.POST(uploadRequest(), routeContext())
  assert.equal(response.status, 409)
  const body = await response.json()
  assert.equal(body.code, 'provider_document_api_unavailable')
  assert.equal(body.data.status, 'failed')
  assert.match(body.error, /suporte do Asaas/u)
  assert.ok(!JSON.stringify(body).includes('synthetic-private'))
  assert.equal(body.providerDiagnostics, undefined)
  assert.equal(h.state.attempts.get(TEST_REQUEST_ID).reason_code, 'provider_rejected')
  assert.deepEqual(Array.from(h.logs.at(-1)[2].provider_error_codes), ['invalid_object'])
  await assert.rejects(h.service.uploadArenaAsaasDocument(documentInput({ requestId: TEST_SECOND_REQUEST_ID })), { code: 'explicit_retry_required' })
  assert.equal(providerPosts(h).length, 1)
})

test('an eligible document is claimed durably before exactly one provider upload, then marked submitted without approval', async () => {
  const h = documentFlowHarness()
  const result = await h.service.uploadArenaAsaasDocument(documentInput())
  assert.equal(result.status, 'submitted')
  assert.equal(result.requestId, TEST_REQUEST_ID)
  assert.equal(providerPosts(h).length, 1)
  assert.equal(claims(h).length, 1)
  const claim = claims(h)[0].args
  assert.equal(claim.p_arena_id, TEST_ARENA_ID)
  assert.equal(claim.p_actor_user_id, TEST_ACTOR_ID)
  assert.equal(claim.p_document_type, 'IDENTIFICATION')
  assert.match(claim.p_content_sha256, /^[a-f0-9]{64}$/u)
  assert.equal(claim.p_provider_status, 'NOT_SENT')
  assert.equal(claim.p_explicit_retry, false)
  assert.equal(h.rpcCalls.at(-1).name, 'finish_arena_asaas_document_upload')
  assert.equal(h.state.attempts.get(TEST_REQUEST_ID).status, 'submitted')
  assert.equal(h.state.groups[0].status, 'NOT_SENT')
})

test('same request and hash replay returns durable submitted status without querying or uploading to the provider again', async () => {
  const h = documentFlowHarness()
  const input = documentInput()
  await h.service.uploadArenaAsaasDocument(input)
  h.state.groups = [{ id: 'group-test', type: 'IDENTIFICATION', status: 'PENDING' }]
  const providerCallsBefore = h.providerRequests.length
  const replay = await h.service.uploadArenaAsaasDocument(input)
  assert.equal(replay.status, 'submitted')
  assert.equal(h.providerRequests.length, providerCallsBefore)
  assert.equal(providerPosts(h).length, 1)
})

test('same request with different file bytes cannot be used for another upload', async () => {
  const h = documentFlowHarness()
  await h.service.uploadArenaAsaasDocument(documentInput())
  const changed = new TextEncoder().encode('%PDF-different-synthetic-file')
  await assert.rejects(h.service.uploadArenaAsaasDocument(documentInput({ bytes: changed,
    file: new File([changed], 'changed-test.pdf', { type: 'application/pdf' }),
  })), { status: 409, code: 'upload_request_conflict' })
  assert.equal(providerPosts(h).length, 1)
})

test('a fresh request after a successful upload requires explicit confirmation and never returns false success', async () => {
  const h = documentFlowHarness()
  await h.service.uploadArenaAsaasDocument(documentInput())
  await assert.rejects(h.service.uploadArenaAsaasDocument(documentInput({ requestId: TEST_SECOND_REQUEST_ID })), {
    status: 409, code: 'explicit_retry_required', attemptStatus: 'submitted',
  })
  assert.equal(providerPosts(h).length, 1)
})

test('a rejected document can be resent under a new operation only after explicit confirmation', async () => {
  const provider = { uploadStatus: 422 }
  const h = documentFlowHarness(provider)
  await assert.rejects(h.service.uploadArenaAsaasDocument(documentInput()), { attemptStatus: 'failed' })
  h.state.groups = [{ id: 'group-test', type: 'IDENTIFICATION', status: 'REJECTED' }]
  provider.uploadStatus = 200
  const result = await h.service.uploadArenaAsaasDocument(documentInput({ requestId: TEST_SECOND_REQUEST_ID, explicitRetry: true }))
  assert.equal(result.status, 'submitted')
  assert.equal(providerPosts(h).length, 2)
  assert.equal(claims(h).at(-1).args.p_explicit_retry, true)
})

for (const status of ['PENDING', 'AWAITING_APPROVAL', 'APPROVED', 'IGNORED', 'UNKNOWN']) {
  test(`provider ${status} status prevents a new claim and upload even when retry is confirmed`, async () => {
    const h = documentFlowHarness({ groups: [{ id: 'group-test', type: 'IDENTIFICATION', status }] })
    await assert.rejects(h.service.uploadArenaAsaasDocument(documentInput({ explicitRetry: true })), { status: 409, code: 'document_not_uploadable' })
    assert.equal(claims(h).length, 0)
    assert.equal(providerPosts(h).length, 0)
  })
}

for (const groups of [[], [{ id: 'foreign-group', type: 'IDENTIFICATION', status: 'NOT_SENT' }],
  [{ id: 'group-test', type: 'IDENTIFICATION', status: 'NOT_SENT', onboardingUrl: 'https://www.asaas.com/onboarding/test-only' }]]) {
  test(`missing, foreign or hosted-only document cannot use API upload: ${JSON.stringify(groups)}`, async () => {
    const h = documentFlowHarness({ groups })
    await assert.rejects(h.service.uploadArenaAsaasDocument(documentInput()), { status: 409, code: 'document_not_uploadable' })
    assert.equal(claims(h).length, 0)
    assert.equal(providerPosts(h).length, 0)
  })
}

test('invalid file content is rejected before a durable claim or provider POST', async () => {
  const h = documentFlowHarness()
  const bytes = new TextEncoder().encode('synthetic-not-a-pdf')
  await assert.rejects(h.service.uploadArenaAsaasDocument(documentInput({ bytes,
    file: new File([bytes], 'renamed-test.pdf', { type: 'application/pdf' }),
  })), { code: 'invalid_file_signature' })
  assert.equal(claims(h).length, 0)
  assert.equal(providerPosts(h).length, 0)
})

test('a lost provider response becomes unknown and a second request cannot reupload it', async () => {
  const h = documentFlowHarness({ uploadThrows: true })
  await assert.rejects(h.service.uploadArenaAsaasDocument(documentInput()), { code: 'upload_result_unknown', attemptStatus: 'unknown' })
  assert.equal(h.state.attempts.get(TEST_REQUEST_ID).status, 'unknown')
  const result = await h.service.uploadArenaAsaasDocument(documentInput({ requestId: TEST_SECOND_REQUEST_ID, explicitRetry: true }))
  assert.equal(result.status, 'unknown')
  assert.equal(result.requestId, TEST_REQUEST_ID)
  assert.equal(providerPosts(h).length, 1)
})

test('two simultaneous HTTP workers consume only one durable claim and provider upload', async () => {
  let release
  const gate = new Promise(resolve => { release = resolve })
  const h = documentFlowHarness({ uploadWait: gate })
  const first = h.service.uploadArenaAsaasDocument(documentInput())
  const deadline = Date.now() + 2000
  try {
    while (providerPosts(h).length === 0 && Date.now() < deadline) await new Promise(resolve => setImmediate(resolve))
    assert.equal(providerPosts(h).length, 1, 'First worker must reach the provider before the bounded deadline')
    const second = await h.service.uploadArenaAsaasDocument(documentInput({ requestId: TEST_SECOND_REQUEST_ID }))
    assert.equal(second.status, 'processing')
    assert.equal(second.requestId, TEST_REQUEST_ID)
    assert.equal(providerPosts(h).length, 1)
  } finally { release() }
  assert.equal((await first).status, 'submitted')
})

test('failure to persist a positive provider acknowledgement returns unknown and blocks blind retry', async () => {
  const h = documentFlowHarness({ finishError: true })
  await assert.rejects(h.service.uploadArenaAsaasDocument(documentInput()), { code: 'upload_result_unknown', attemptStatus: 'unknown' })
  assert.equal(providerPosts(h).length, 1)
  const duplicate = await h.service.uploadArenaAsaasDocument(documentInput())
  assert.equal(duplicate.status, 'processing')
  assert.equal(providerPosts(h).length, 1)
})

test('refresh reconciles an unknown attempt only after positive provider status, without uploading', async () => {
  const h = documentFlowHarness({ uploadThrows: true })
  await assert.rejects(h.service.uploadArenaAsaasDocument(documentInput()))
  h.state.groups = [{ id: 'group-test', type: 'IDENTIFICATION', status: 'NOT_SENT' }]
  assert.equal((await h.service.getArenaAsaasDocuments(TEST_ARENA_ID, TEST_ACTOR_ID)).groups[0].attemptStatus, 'unknown')
  assert.equal(h.rpcCalls.some(call => call.name === 'reconcile_arena_asaas_document_upload'), false)
  h.state.groups = [{ id: 'group-test', type: 'IDENTIFICATION', status: 'AWAITING_APPROVAL' }]
  const refreshed = await h.service.getArenaAsaasDocuments(TEST_ARENA_ID, TEST_ACTOR_ID)
  assert.equal(refreshed.groups[0].attemptStatus, 'submitted')
  assert.equal(refreshed.groups[0].canUpload, false)
  assert.equal(providerPosts(h).length, 1)
})

test('without the migration, provider lookup remains readable but every API upload fails closed', async () => {
  const h = documentFlowHarness({ missingRpc: true })
  const documents = await h.service.getArenaAsaasDocuments(TEST_ARENA_ID, TEST_ACTOR_ID)
  assert.equal(documents.uploadAvailable, false)
  assert.equal(documents.groups[0].canUpload, false)
  const requestsBefore = h.providerRequests.length
  await assert.rejects(h.service.uploadArenaAsaasDocument(documentInput()), { status: 503, code: 'document_upload_unavailable' })
  assert.equal(h.providerRequests.length, requestsBefore)
  assert.equal(providerPosts(h).length, 0)
})

test('first document sync waits for the provider startup interval without making an upstream request', async () => {
  const h = documentFlowHarness({ account: { updated_at: new Date().toISOString(), last_status_checked_at: null } })
  await assert.rejects(h.service.getArenaAsaasDocuments(TEST_ARENA_ID, TEST_ACTOR_ID), { status: 409 })
  assert.equal(h.providerRequests.length, 0)
})

test('authenticated GET exposes operational documents without credentials or raw upstream objects', async () => {
  const h = documentFlowHarness()
  const response = await h.route.GET(new Request('https://arena.example/documents'), routeContext())
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.success, true)
  assert.equal(body.data.groups[0].canUpload, true)
  assert.ok(!JSON.stringify(body).includes('synthetic-subaccount-test-only'))
  assert.equal(h.authCalls[0], TEST_ARENA_ID)
})

test('authenticated multipart POST uses the session actor and returns delivery status distinct from approval', async () => {
  const h = documentFlowHarness()
  const response = await h.route.POST(uploadRequest(), routeContext())
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.data.status, 'submitted')
  assert.equal(claims(h)[0].args.p_actor_user_id, TEST_ACTOR_ID)
  assert.equal(providerPosts(h).length, 1)
})

for (const method of ['GET', 'POST']) {
  test(`${method} cross-arena access is rejected before consulting the database or provider`, async () => {
    const h = documentFlowHarness()
    const request = method === 'POST' ? uploadRequest({ arenaId: TEST_FOREIGN_ARENA_ID }) : new Request('https://arena.example/documents')
    const response = await h.route[method](request, routeContext(TEST_FOREIGN_ARENA_ID))
    assert.equal(response.status, 403)
    assert.equal(h.rpcCalls.length, 0)
    assert.equal(h.providerRequests.length, 0)
    assert.ok(!JSON.stringify(await response.json()).includes('synthetic-private'))
  })
  test(`${method} unauthenticated access does not reach provider credentials or document storage`, async () => {
    const h = documentFlowHarness({ unauthenticated: true })
    const response = await h.route[method](method === 'POST' ? uploadRequest() : new Request('https://arena.example/documents'), routeContext())
    assert.equal(response.status, 401)
    assert.equal(h.rpcCalls.length, 0)
    assert.equal(h.providerRequests.length, 0)
  })
}

test('a cross-origin upload is rejected before authentication and reading document bytes', async () => {
  const h = documentFlowHarness()
  const response = await h.route.POST(uploadRequest({ origin: 'https://outside.example' }), routeContext())
  assert.equal(response.status, 403)
  assert.equal(h.authCalls.length, 0)
  assert.equal(h.rpcCalls.length, 0)
  assert.equal(h.providerRequests.length, 0)
})

test('invalid route identifiers and forged payload fields cause no durable or provider effect', async () => {
  const h = documentFlowHarness()
  assert.equal((await h.route.GET(new Request('https://arena.example/documents'), routeContext('not-an-arena'))).status, 400)
  assert.equal((await h.route.POST(uploadRequest({ modify: form => form.set('actorId', 'forged-actor') }), routeContext())).status, 400)
  assert.equal(h.rpcCalls.length, 0)
  assert.equal(h.providerRequests.length, 0)
})

test('provider and database failures return only safe errors and reason codes to the client and observer', async () => {
  for (const options of [{ dbDenied: true }, { uploadThrows: true }, { uploadStatus: 500 }, { finishError: true }]) {
    const h = documentFlowHarness(options)
    const response = await h.route.POST(uploadRequest(), routeContext())
    assert.ok(response.status >= 400)
    const body = await response.json()
    const serialized = JSON.stringify({ body, logs: h.logs })
    assert.ok(!serialized.includes('synthetic-private'))
    assert.ok(!serialized.includes('synthetic-subaccount-test-only'))
    assert.ok(!serialized.includes('synthetic-test.pdf'))
    assert.ok(!serialized.includes('%PDF'))
  }
})

test('a provider validation rejection exposes a neutral message and logs only allowlisted diagnostic codes', async () => {
  const h = documentFlowHarness({ uploadStatus: 400, uploadBody: JSON.stringify({ errors: [
    { code: 'invalid_action', description: 'synthetic-private-provider-detail' },
    { code: 'synthetic-private-unknown-code', description: 'synthetic-private-file-name.pdf' },
  ] }) })
  const response = await h.route.POST(uploadRequest(), routeContext())
  assert.equal(response.status, 422)
  const body = await response.json()
  assert.ok(!/formato|extens[aã]o/iu.test(body.error))
  assert.equal(body.code, 'provider_document_rejected')
  assert.equal(body.data.status, 'failed')
  assert.equal(h.state.attempts.get(TEST_REQUEST_ID).reason_code, 'provider_rejected')
  const diagnostic = h.logs.find(entry => entry[1] === 'arena_asaas_documents.upload.rejected')[2]
  assert.equal(diagnostic.request_id, TEST_REQUEST_ID)
  assert.equal(diagnostic.provider_http_status, 400)
  assert.deepEqual(Array.from(diagnostic.provider_error_codes), ['invalid_action', 'unclassified'])
  assert.equal(body.providerDiagnostics, undefined)
  assert.ok(!JSON.stringify({ body, logs: h.logs }).includes('synthetic-private'))
  assert.equal(providerPosts(h).length, 1)
  const replay = await h.service.uploadArenaAsaasDocument(documentInput())
  assert.equal(replay.status, 'failed')
  assert.equal(providerPosts(h).length, 1)
})
