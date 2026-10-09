import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

const { assertAsaasDocumentUploadOrigin, parseAsaasDocumentUploadRequest } =
  loadTypescriptModule('src/modules/arenas/domain/asaas-document-upload-request.ts')
const url = 'https://arena.example/api/arenas/test/asaas/documents'
const requestId = '22222222-2222-4222-8222-222222222222'

function request(change = () => {}, headers = {}) {
  const form = new FormData()
  form.set('documentGroupId', 'group-test')
  form.set('requestId', requestId)
  form.set('explicitRetry', 'false')
  form.set('documentFile', new File(['%PDF-test-only'], 'synthetic-test.pdf', { type: 'application/pdf' }))
  change(form)
  return new Request(url, { method: 'POST', headers: { origin: 'https://arena.example', ...headers }, body: form })
}

test('multipart parser preserves the operation identity, explicit retry and file bytes', async () => {
  const parsed = await parseAsaasDocumentUploadRequest(request(form => form.set('explicitRetry', 'true')))
  assert.equal(parsed.documentGroupId, 'group-test')
  assert.equal(parsed.requestId, requestId)
  assert.equal(parsed.explicitRetry, true)
  assert.equal(parsed.file.name, 'synthetic-test.pdf')
  assert.equal(parsed.file.type, 'application/pdf')
  assert.equal(new TextDecoder().decode(parsed.bytes), '%PDF-test-only')
})

test('retry defaults to false and cannot be supplied as an arbitrary truthy value', async () => {
  assert.equal((await parseAsaasDocumentUploadRequest(request(form => form.delete('explicitRetry')))).explicitRetry, false)
  await assert.rejects(parseAsaasDocumentUploadRequest(request(form => form.set('explicitRetry', '1'))), { code: 'invalid_upload_fields' })
})

test('the upload must originate from the same authenticated panel origin', () => {
  assert.doesNotThrow(() => assertAsaasDocumentUploadOrigin(request()))
  for (const headers of [{ origin: 'https://outside.example' }, { origin: '' },
    { origin: 'https://arena.example', 'sec-fetch-site': 'cross-site' }]) {
    assert.throws(() => assertAsaasDocumentUploadOrigin(request(() => {}, headers)), { status: 403, code: 'invalid_upload_origin' })
  }
})

for (const modify of [
  form => form.append('documentFile', new File(['other-test'], 'other-test.pdf')),
  form => form.append('requestId', requestId),
  form => form.set('actorId', 'forged-actor'),
  form => form.set('type', 'SELF_CHOSEN_DOCUMENT_TYPE'),
  form => form.set('arenaId', 'arena-foreign'),
  form => form.set('documentGroupId', '../group-foreign'),
  form => form.set('requestId', 'not-a-uuid'),
  form => form.delete('documentFile'),
  form => form.set('documentFile', 'not-a-file'),
]) {
  test(`invalid or duplicated upload fields are rejected: ${modify.toString()}`, async () => {
    await assert.rejects(parseAsaasDocumentUploadRequest(request(modify)), { status: 400, code: 'invalid_upload_fields' })
  })
}

test('JSON and boundary-less multipart requests are not accepted', async () => {
  for (const contentType of ['application/json', 'multipart/form-data']) {
    await assert.rejects(parseAsaasDocumentUploadRequest(new Request(url, {
      method: 'POST', body: '{}', headers: { 'content-type': contentType },
    })), { status: 415, code: 'invalid_upload_content_type' })
  }
})

test('oversized Content-Length rejects the body before it is read', async () => {
  let read = false
  const fakeRequest = {
    headers: new Headers({ 'content-type': 'multipart/form-data; boundary=test', 'content-length': String(3 * 1024 * 1024 + 64 * 1024 + 1) }),
    get body() { read = true; throw new Error('Must not read rejected request') },
  }
  await assert.rejects(parseAsaasDocumentUploadRequest(fakeRequest), { status: 413 })
  assert.equal(read, false)
})

test('streamed body limits apply even without a reliable Content-Length', async () => {
  let cancelled = false
  let sent = false
  const body = new ReadableStream({
    pull(controller) {
      if (!sent) {
        sent = true
        controller.enqueue(new Uint8Array(3 * 1024 * 1024 + 64 * 1024 + 1))
      }
    },
    cancel() { cancelled = true },
  })
  await assert.rejects(parseAsaasDocumentUploadRequest(new Request(url, {
    method: 'POST', body, duplex: 'half', headers: { 'content-type': 'multipart/form-data; boundary=test' },
  })), { status: 413, code: 'file_too_large' })
  assert.equal(cancelled, true)
})

test('a file over 3 MiB is rejected even if the multipart envelope stays below its own limit', async () => {
  await assert.rejects(parseAsaasDocumentUploadRequest(request(form => form.set('documentFile',
    new File([new Uint8Array(3 * 1024 * 1024 + 1)], 'oversized-test.pdf', { type: 'application/pdf' }),
  ))), { status: 413, code: 'file_too_large' })
})

test('invalid Content-Length and malformed multipart do not echo any request contents', async () => {
  await assert.rejects(parseAsaasDocumentUploadRequest(request(() => {}, { 'content-length': 'invalid-test' })), { code: 'invalid_content_length' })
  await assert.rejects(parseAsaasDocumentUploadRequest(new Request(url, {
    method: 'POST', body: 'synthetic-private-request-content',
    headers: { 'content-type': 'multipart/form-data; boundary=test' },
  })), error => {
    assert.equal(error.code, 'invalid_upload_body')
    assert.ok(!error.message.includes('synthetic-private'))
    return true
  })
})
