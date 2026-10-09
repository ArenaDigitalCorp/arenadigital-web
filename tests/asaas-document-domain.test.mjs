import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

const { parseAsaasDocumentGroups, safeAsaasOnboardingUrl, validateAsaasDocumentFile } =
  loadTypescriptModule('src/modules/arenas/domain/asaas-documents.ts')
const { ASAAS_DOCUMENT_TYPES, MAX_ASAAS_DOCUMENT_FILE_BYTES } =
  loadTypescriptModule('src/modules/arenas/types/asaas-documents.types.ts')

function group(overrides = {}) {
  return parseAsaasDocumentGroups({ data: [{
    id: 'group-test', type: 'IDENTIFICATION', title: 'Documento de teste',
    status: 'NOT_SENT', description: null, onboardingUrl: null, ...overrides,
  }] })[0]
}

for (const type of ASAAS_DOCUMENT_TYPES) {
  test(`only requested ${type} documents with NOT_SENT or REJECTED status allow API upload`, () => {
    for (const status of ['NOT_SENT', 'REJECTED']) assert.equal(group({ type, status }).canUpload, true)
    for (const status of ['PENDING', 'AWAITING_APPROVAL', 'APPROVED', 'IGNORED']) {
      assert.equal(group({ type, status }).canUpload, false)
    }
  })
}

test('unknown provider statuses and document types fail closed', () => {
  assert.equal(group({ status: 'NEW_PROVIDER_STATUS' }).status, 'UNKNOWN')
  assert.equal(group({ status: 'NEW_PROVIDER_STATUS' }).canUpload, false)
  assert.equal(group({ type: 'NEW_PROVIDER_TYPE' }).type, 'UNKNOWN')
  assert.equal(group({ type: 'NEW_PROVIDER_TYPE' }).canUpload, false)
})

test('provider-issued hosted onboarding replaces API upload without guessing a URL', () => {
  const hosted = group({ onboardingUrl: 'https://www.asaas.com/onboarding/test-only' })
  assert.equal(hosted.onboardingUrl, 'https://www.asaas.com/onboarding/test-only')
  assert.equal(hosted.canUpload, false)
  const malformed = group({ onboardingUrl: 'https://asaas.example/onboarding' })
  assert.equal(malformed.onboardingUrl, null)
  assert.equal(malformed.canUpload, false)
})

test('hosted onboarding links are restricted to HTTPS Asaas domains without embedded credentials', () => {
  for (const url of ['https://asaas.com/path', 'https://www.asaas.com.br/path', 'https://api-sandbox.asaas.com/path']) {
    assert.equal(safeAsaasOnboardingUrl(url), url)
  }
  for (const url of [null, 42, '', 'javascript:alert(1)', 'http://asaas.com/path',
    'https://asaas.com.example/path', 'https://evilasaas.com/path', 'https://asaas.com@outside.example/',
    'https://user:pass@asaas.com/path', 'https://outside.example/?next=https://asaas.com']) {
    assert.equal(safeAsaasOnboardingUrl(url), null)
  }
})

test('malformed, duplicate and oversized provider lists are rejected without echoing their contents', () => {
  for (const payload of [null, {}, { data: {} }, { data: [null] }, { data: [{ id: '../private' }] },
    { data: [{ id: 'same' }, { id: 'same' }] }, { data: Array.from({ length: 101 }, (_, index) => ({ id: `group-${index}` })) }]) {
    assert.throws(() => parseAsaasDocumentGroups(payload), error => {
      assert.equal(error.status, 502)
      assert.ok(!error.message.includes('../private'))
      return true
    })
  }
  assert.equal(parseAsaasDocumentGroups({ data: [] }).length, 0)
})

const signatures = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2d],
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
}
const extensions = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }

function file(mime, size = 32, name = `original-test.${extensions[mime]}`) {
  const bytes = new Uint8Array(size)
  bytes.set(signatures[mime] ?? [])
  return { descriptor: { name, size, type: mime }, bytes }
}

for (const mime of Object.keys(signatures)) {
  test(`valid ${mime} content produces a neutral multipart filename`, () => {
    const { descriptor, bytes } = file(mime)
    const result = validateAsaasDocumentFile(descriptor, group(), bytes)
    assert.equal(result.mimeType, mime)
    assert.equal(result.filename, `document.${extensions[mime]}`)
    assert.ok(!result.filename.includes('original-test'))
  })
}

test('3 MiB boundary is accepted and larger files are rejected', () => {
  assert.equal(MAX_ASAAS_DOCUMENT_FILE_BYTES, 3 * 1024 * 1024)
  const allowed = file('application/pdf', MAX_ASAAS_DOCUMENT_FILE_BYTES)
  assert.equal(validateAsaasDocumentFile(allowed.descriptor, group(), allowed.bytes).mimeType, 'application/pdf')
  const oversized = file('application/pdf', MAX_ASAAS_DOCUMENT_FILE_BYTES + 1)
  assert.throws(() => validateAsaasDocumentFile(oversized.descriptor, group(), oversized.bytes), {
    status: 413, code: 'file_too_large',
  })
})

test('file length, MIME, extension and content signature must agree', () => {
  const valid = file('application/pdf')
  for (const descriptor of [
    { ...valid.descriptor, size: 0 },
    { ...valid.descriptor, size: 33 },
    { ...valid.descriptor, size: NaN },
  ]) assert.throws(() => validateAsaasDocumentFile(descriptor, group(), valid.bytes), { code: 'invalid_file_size' })
  assert.throws(() => validateAsaasDocumentFile({ ...valid.descriptor, type: 'text/html' }, group(), valid.bytes), { code: 'invalid_file_type' })
  assert.throws(() => validateAsaasDocumentFile({ ...valid.descriptor, name: 'renamed-test.png' }, group(), valid.bytes), { code: 'invalid_file_signature' })
  assert.throws(() => validateAsaasDocumentFile(valid.descriptor, group(), new Uint8Array(valid.bytes.length)), { code: 'invalid_file_signature' })
  const uppercase = file('image/jpeg', 32, 'document-test.JPEG')
  assert.equal(validateAsaasDocumentFile({ ...uppercase.descriptor, type: 'IMAGE/JPEG' }, group(), uppercase.bytes).mimeType, 'image/jpeg')
})

test('identification selfie accepts image content and rejects PDF', () => {
  const selfie = group({ type: 'IDENTIFICATION_SELFIE' })
  assert.deepEqual(Array.from(selfie.allowedMimeTypes), ['image/jpeg', 'image/png'])
  for (const mime of ['image/jpeg', 'image/png']) {
    const image = file(mime)
    assert.equal(validateAsaasDocumentFile(image.descriptor, selfie, image.bytes).mimeType, mime)
  }
  const pdf = file('application/pdf')
  assert.throws(() => validateAsaasDocumentFile(pdf.descriptor, selfie, pdf.bytes), { code: 'invalid_file_type' })
})

test('file validation errors never expose the original filename or document body', () => {
  const invalid = file('application/pdf', 32, 'synthetic-private-label.exe')
  assert.throws(() => validateAsaasDocumentFile(invalid.descriptor, group(), invalid.bytes), error => {
    assert.ok(!error.message.includes('synthetic-private-label'))
    assert.ok(!error.message.includes('%PDF'))
    return true
  })
})
