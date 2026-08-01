export type LogSeverity = 'debug' | 'info' | 'warn' | 'error'
export type LogFields = Record<string, unknown>

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u
const SENSITIVE_FIELD_PATTERN = /(authorization|cookie|token|secret|password|signature|api[_-]?key|access[_-]?key|email|cpf|cnpj|phone|payload|request[_-]?body|response[_-]?body|headers)/iu
const MAX_OBJECT_DEPTH = 3
const MAX_COLLECTION_SIZE = 25

function safeError(error: Error): Record<string, string> {
  const fields: Record<string, string> = { error_name: error.name || 'Error' }
  const code = (error as Error & { code?: unknown }).code
  if (typeof code === 'string' && /^[A-Za-z0-9._:-]{1,80}$/u.test(code)) {
    fields.error_code = code
  }
  return fields
}

function sanitizeValue(value: unknown, key: string, depth: number): unknown {
  if (SENSITIVE_FIELD_PATTERN.test(key)) return '[REDACTED]'
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value
  if (typeof value === 'string') return value.slice(0, 300)
  if (typeof value === 'undefined') return undefined
  if (value instanceof Error) return safeError(value)
  if (value instanceof Date) return value.toISOString()
  if (depth >= MAX_OBJECT_DEPTH) return '[TRUNCATED]'
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_COLLECTION_SIZE)
      .map((item) => sanitizeValue(item, key, depth + 1))
  }
  if (typeof value === 'object') {
    const sanitized: Record<string, unknown> = {}
    for (const [nestedKey, nestedValue] of Object.entries(value).slice(0, MAX_COLLECTION_SIZE)) {
      const nextValue = sanitizeValue(nestedValue, nestedKey, depth + 1)
      if (typeof nextValue !== 'undefined') sanitized[nestedKey] = nextValue
    }
    return sanitized
  }
  return String(value).slice(0, 100)
}

export function normalizeCorrelationId(
  candidate: string | null | undefined,
  generate: () => string = () => crypto.randomUUID(),
): string {
  const normalized = candidate?.trim()
  return normalized && CORRELATION_ID_PATTERN.test(normalized) ? normalized : generate()
}

export function sanitizeLogFields(fields: LogFields): LogFields {
  return sanitizeValue(fields, 'fields', 0) as LogFields
}

export function createStructuredLogRecord(input: {
  severity: LogSeverity
  event: string
  correlationId: string
  fields?: LogFields
  now?: () => Date
}) {
  const event = /^[a-z0-9][a-z0-9._-]{2,100}$/u.test(input.event)
    ? input.event
    : 'observability.invalid_event_name'
  return {
    timestamp: (input.now ?? (() => new Date()))().toISOString(),
    severity: input.severity,
    service: 'arenadigital-web',
    event,
    correlation_id: input.correlationId,
    ...sanitizeLogFields(input.fields ?? {}),
  }
}

export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  timeoutError: () => Error = () => new Error('Operation timed out'),
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(timeoutError()), timeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export type ReadinessStatus =
  | { ready: true; database: 'ready' }
  | { ready: false; database: 'unavailable'; reason: 'timeout' | 'dependency_error' }

export async function checkDatabaseReadiness(
  probe: () => Promise<void>,
  timeoutMs = 2000,
): Promise<ReadinessStatus> {
  try {
    await withTimeout(probe(), timeoutMs, () => {
      const error = new Error('Readiness probe timed out')
      error.name = 'ReadinessTimeoutError'
      return error
    })
    return { ready: true, database: 'ready' }
  } catch (error) {
    return {
      ready: false,
      database: 'unavailable',
      reason: error instanceof Error && error.name === 'ReadinessTimeoutError'
        ? 'timeout'
        : 'dependency_error',
    }
  }
}
