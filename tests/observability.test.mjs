import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createStructuredLogRecord,
  checkDatabaseReadiness,
  normalizeCorrelationId,
  sanitizeLogFields,
} from '../src/lib/observability/core.ts'

test('accepts safe correlation IDs and replaces invalid input', () => {
  assert.equal(normalizeCorrelationId('trace-12345678', () => 'generated'), 'trace-12345678')
  assert.equal(normalizeCorrelationId('bad id', () => 'generated'), 'generated')
  assert.equal(normalizeCorrelationId(null, () => 'generated'), 'generated')
})

test('redacts sensitive fields recursively and never serializes error messages', () => {
  const fields = sanitizeLogFields({
    outcome: 'failed',
    authorization: 'Bearer should-not-appear',
    nested: { email: 'person@example.invalid', count: 2 },
    error: Object.assign(new Error('secret database detail'), { code: 'DB_TIMEOUT' }),
  })
  const serialized = JSON.stringify(fields)
  assert.doesNotMatch(serialized, /should-not-appear|person@example|secret database detail/u)
  assert.equal(fields.authorization, '[REDACTED]')
  assert.deepEqual(fields.error, { error_name: 'Error', error_code: 'DB_TIMEOUT' })
})

test('creates one structured vendor-neutral record', () => {
  const record = createStructuredLogRecord({
    severity: 'info',
    event: 'payments.subscribe.completed',
    correlationId: 'trace-12345678',
    fields: { outcome: 'completed', duration_ms: 12 },
    now: () => new Date('2026-08-01T12:00:00.000Z'),
  })
  assert.equal(record.timestamp, '2026-08-01T12:00:00.000Z')
  assert.equal(record.service, 'arenadigital-web')
  assert.equal(record.correlation_id, 'trace-12345678')
  assert.equal(record.duration_ms, 12)
})

test('readiness distinguishes success, dependency error and timeout', async () => {
  assert.deepEqual(await checkDatabaseReadiness(async () => undefined, 20), {
    ready: true,
    database: 'ready',
  })
  assert.deepEqual(await checkDatabaseReadiness(async () => { throw new Error('db') }, 20), {
    ready: false,
    database: 'unavailable',
    reason: 'dependency_error',
  })
  assert.deepEqual(await checkDatabaseReadiness(
    () => new Promise((resolve) => setTimeout(resolve, 30)),
    1,
  ), {
    ready: false,
    database: 'unavailable',
    reason: 'timeout',
  })
})
