import { headers } from 'next/headers'
import * as logfire from 'logfire'
import {
  createStructuredLogRecord,
  normalizeCorrelationId,
  type LogFields,
  type LogSeverity,
} from './core'

export const CORRELATION_ID_HEADER = 'x-correlation-id'

function writeLog(severity: LogSeverity, record: ReturnType<typeof createStructuredLogRecord>) {
  const { event, ...attributes } = record
  try {
    if (severity === 'error') logfire.error(event, attributes)
    else if (severity === 'warn') logfire.warning(event, attributes)
    else if (severity === 'debug') logfire.debug(event, attributes)
    else logfire.info(event, attributes)
  } catch {
    // Observability must never break the user request.
  }

  const line = JSON.stringify(record)
  if (severity === 'error') console.error(line)
  else if (severity === 'warn') console.warn(line)
  else if (severity === 'debug') console.debug(line)
  else console.info(line)
}

export function logStructured(input: {
  severity: LogSeverity
  event: string
  correlationId: string
  fields?: LogFields
}) {
  writeLog(input.severity, createStructuredLogRecord(input))
}

function createOperationObserver(input: {
  correlationId: string
  component: string
  operation: string
  startedAt?: number
}) {
  const startedAt = input.startedAt ?? Date.now()
  const baseFields = { component: input.component, operation: input.operation }
  let operationSpan: ReturnType<typeof logfire.startSpan> | null = null
  try {
    operationSpan = logfire.startSpan(`${input.component}.${input.operation}`, {
      component: input.component,
      operation: input.operation,
      correlation_id: input.correlationId,
    })
  } catch {
    // The console logger remains available if tracing is not configured.
  }
  let spanEnded = false

  return {
    correlationId: input.correlationId,
    log(severity: LogSeverity, event: string, fields: LogFields = {}) {
      logStructured({
        severity,
        event,
        correlationId: input.correlationId,
        fields: { ...baseFields, ...fields },
      })
    },
    complete(outcome: string, fields: LogFields = {}) {
      const duration = Math.max(0, Date.now() - startedAt)
      if (operationSpan && !spanEnded) {
        operationSpan.setAttribute('outcome', outcome)
        operationSpan.setAttribute('duration_ms', duration)
        operationSpan.end()
        spanEnded = true
      }
      logStructured({
        severity: outcome === 'failed' ? 'error' : 'info',
        event: `${input.component}.${input.operation}.completed`,
        correlationId: input.correlationId,
        fields: {
          ...baseFields,
          outcome,
          duration_ms: duration,
          ...fields,
        },
      })
    },
  }
}

export function observeHttpRequest(
  request: Request,
  input: { component: string; operation: string },
) {
  const correlationId = normalizeCorrelationId(request.headers.get(CORRELATION_ID_HEADER))
  const observer = createOperationObserver({ correlationId, ...input })
  observer.log('info', `${input.component}.${input.operation}.started`, {
    method: request.method,
  })
  return {
    ...observer,
    respond<T extends Response>(response: T): T {
      response.headers.set(CORRELATION_ID_HEADER, correlationId)
      response.headers.set('Cache-Control', 'no-store')
      observer.complete(response.status >= 500 ? 'failed' : 'completed', {
        http_status: response.status,
      })
      return response
    },
  }
}

export async function observeServerAction(input: { component: string; operation: string }) {
  const incomingHeaders = await headers()
  const correlationId = normalizeCorrelationId(incomingHeaders.get(CORRELATION_ID_HEADER))
  const observer = createOperationObserver({ correlationId, ...input })
  observer.log('info', `${input.component}.${input.operation}.started`)
  return observer
}
