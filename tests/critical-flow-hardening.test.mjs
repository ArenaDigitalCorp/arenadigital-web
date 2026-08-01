import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  MAX_UPLOAD_BYTES,
  MAX_MULTIPART_BODY_BYTES,
  UploadPolicyError,
  createUploadObjectName,
  validateImageSignature,
  validateMultipartContentLength,
  validateUploadDescriptor,
} from '../src/lib/upload-policy.ts'
import { transactionActionSchema } from '../src/modules/finance/schemas/transaction-action.schema.ts'

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

function validTransaction(overrides = {}) {
  return {
    type: 'entrada',
    category: 'Aluguel',
    description: 'Reserva avulsa',
    quantity: 2,
    unit_value: 50,
    discount: 10,
    total_value: 90,
    launch_date: '2026-08-01',
    registration_date: '2026-08-01',
    atleta_id: null,
    modo_pagamento_id: null,
    ...overrides,
  }
}

test('finance action DTO is a strict business-field allowlist', () => {
  assert.equal(transactionActionSchema.safeParse(validTransaction()).success, true)

  for (const reserved of ['id', 'arena_id', 'registered_by', 'created_at', 'source_type', 'source_id', 'metadata']) {
    const result = transactionActionSchema.safeParse(validTransaction({ [reserved]: 'attacker-owned' }))
    assert.equal(result.success, false, `${reserved} must be rejected`)
  }

  assert.equal(transactionActionSchema.safeParse(validTransaction({ total_value: 1 })).success, false)
})

test('finance action parses before persistence and owns tenant and actor ids', async () => {
  const contents = await source('src/modules/finance/actions/financeActions.ts')
  assert.match(contents, /transactionActionSchema\.safeParse\(input\)/)
  assert.match(contents, /arena_id: arenaId/)
  assert.match(contents, /registered_by: dbUserId/)
  assert.doesNotMatch(contents, /source_type:\s*input/)
  assert.doesNotMatch(contents, /source_id:\s*input/)
})

test('upload allowlist enforces size, matching extension and real image signature', () => {
  const accepted = validateUploadDescriptor({ name: 'quadra.PNG', size: 128, type: 'image/png' })
  assert.deepEqual(accepted, { contentType: 'image/png', extension: 'png' })
  assert.throws(
    () => validateUploadDescriptor({ name: 'quadra.svg', size: 128, type: 'image/svg+xml' }),
    UploadPolicyError,
  )
  assert.throws(
    () => validateUploadDescriptor({ name: 'quadra.png', size: MAX_UPLOAD_BYTES + 1, type: 'image/png' }),
    (error) => error instanceof UploadPolicyError && error.status === 413,
  )
  assert.throws(
    () => validateUploadDescriptor({ name: 'quadra.jpg', size: 128, type: 'image/png' }),
    UploadPolicyError,
  )

  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  assert.doesNotThrow(() => validateImageSignature(png, 'image/png'))
  assert.throws(() => validateImageSignature(Buffer.from('not an image'), 'image/png'), UploadPolicyError)
})

test('upload rejects an oversized multipart body before parsing when length is known', async () => {
  assert.doesNotThrow(() => validateMultipartContentLength(null))
  assert.doesNotThrow(() => validateMultipartContentLength(String(MAX_MULTIPART_BODY_BYTES)))
  assert.throws(
    () => validateMultipartContentLength(String(MAX_MULTIPART_BODY_BYTES + 1)),
    (error) => error instanceof UploadPolicyError && error.status === 413,
  )
  assert.throws(() => validateMultipartContentLength('invalid'), UploadPolicyError)

  const uploadRoute = await source('src/app/api/upload/route.ts')
  const headerGuard = uploadRoute.indexOf('validateMultipartContentLength(request.headers.get("content-length"))')
  const multipartParse = uploadRoute.indexOf('request.formData()')
  assert.ok(headerGuard >= 0 && multipartParse > headerGuard, 'header guard must run before multipart parsing')
  assert.match(uploadRoute, /validateUploadDescriptor\(file\)/)
})

test('upload object names are canonical and cannot inherit a user path', () => {
  const name = createUploadObjectName('webp', 'b4000000-0000-4000-8000-000000000001')
  assert.equal(name, 'b4000000-0000-4000-8000-000000000001.webp')
  assert.doesNotMatch(name, /[\\/]/)
  assert.throws(() => createUploadObjectName('../svg', 'b4000000-0000-4000-8000-000000000001'), UploadPolicyError)
})

test('upload and WhatsApp routes require arena admin scope', async () => {
  const [uploadRoute, whatsappRoute, r2Client] = await Promise.all([
    source('src/app/api/upload/route.ts'),
    source('src/app/api/whatsapp/embedded-signup/route.ts'),
    source('src/lib/r2Client.ts'),
  ])

  assert.match(uploadRoute, /assertArenaAdminAccess\(fields\.arenaId\)/)
  assert.match(uploadRoute, /assertCourtAccess\(fields\.spaceId, fields\.arenaId\)/)
  assert.doesNotMatch(uploadRoute, /assertArenaAccess\(/)
  assert.match(uploadRoute, /error instanceof AuthorizationError[\s\S]{0,160}status: error\.status/)
  assert.match(r2Client, /IfNoneMatch:\s*["']\*["']/)

  assert.match(whatsappRoute, /assertArenaAdminAccess\(parsed\.arenaId\)/)
  assert.doesNotMatch(whatsappRoute, /assertArenaBackofficeAccess/)
  assert.match(whatsappRoute, /error instanceof AuthorizationError[\s\S]{0,160}status: error\.status/)
  assert.doesNotMatch(whatsappRoute, /console\.error\([^\n]*message/)
})

test('loyalty mutations are admin-only, idempotent RPC calls', async () => {
  const [actions, repository, sendModal, redemptionModal] = await Promise.all([
    source('src/modules/loyalty/actions/loyaltyActions.ts'),
    source('src/modules/loyalty/repositories/SupabaseLoyaltyRepository.ts'),
    source('src/modules/loyalty/components/NewSendModal.tsx'),
    source('src/modules/loyalty/components/NewRedemptionModal.tsx'),
  ])

  assert.match(actions, /record_backoffice_loyalty_transaction/)
  assert.match(actions, /assertArenaAdminAccess\(parsed\.arenaId\)/)
  assert.doesNotMatch(repository, /programa_fidelidade_extrato'[\s\S]{0,100}\.insert/)
  for (const modal of [sendModal, redemptionModal]) {
    assert.match(modal, /operationId\.current \?\?= crypto\.randomUUID\(\)/)
    assert.match(modal, /operationId: operationId\.current/)
  }
})

test('cited mutation consumers check structured failures before local success state', async () => {
  const [transactions, products, booking, court] = await Promise.all([
    source('src/modules/finance/components/TransactionsPageClient.tsx'),
    source('src/modules/products/components/ProductsPageClient.tsx'),
    source('src/modules/bookings/components/BookingDetailsModal.tsx'),
    source('src/modules/courts/components/CourtForm.tsx'),
  ])

  assert.match(transactions, /deleteTransactionAction[\s\S]{0,120}if \(!result\.success\) throw/)
  assert.match(products, /deleteProductAction[\s\S]{0,120}if \(!result\.success\) throw/)
  assert.match(booking, /updateBookingStatusAction[\s\S]{0,120}if \(!result\.success\) throw/)
  assert.match(court, /updateCourtAction\(arenaId, newCourt\.id[\s\S]{0,160}if \(!updateRes\.success\) throw/)
})
