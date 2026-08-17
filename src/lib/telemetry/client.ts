'use client'

import * as logfire from '@pydantic/logfire-browser'

type TelemetryValue = string | number | boolean | null | undefined
type TelemetryParams = Record<string, TelemetryValue>
type ActionOutcome = 'success' | 'failure'

const EVENT_NAME_PATTERN = /^[a-z][a-z0-9_]{0,39}$/u
const PARAMETER_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/u
const MAX_STRING_LENGTH = 120

// Only these dimensions are allowed to leave the browser. In particular,
// names, contact data, free text, tokens and payment details are excluded.
const SAFE_PARAMETER_KEYS = new Set([
  'app_surface',
  'environment',
  'route',
  'screen_name',
  'page_path',
  'navigation_label',
  'destination',
  'arena_id',
  'station_id',
  'court_id',
  'product_id',
  'order_id',
  'entity_id',
  'entity_type',
  'action',
  'outcome',
  'error_type',
  'source',
  'status',
  'http_status',
  'plan_key',
  'booking_type',
  'payment_method',
  'provider',
  'recurring',
  'edit_mode',
  'items_count',
  'conflict_count',
  'query_present',
])

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

function sanitizeValue(value: TelemetryValue): TelemetryValue {
  if (typeof value === 'string') return value.slice(0, MAX_STRING_LENGTH)
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'boolean' || value === null) return value
  return undefined
}

function sanitizeParams(params: TelemetryParams): TelemetryParams {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([key]) => SAFE_PARAMETER_KEYS.has(key) && PARAMETER_KEY_PATTERN.test(key))
      .map(([key, value]) => [key, sanitizeValue(value)])
      .filter(([, value]) => typeof value !== 'undefined'),
  )
}

function currentRoute() {
  return typeof window === 'undefined' ? undefined : window.location.pathname
}

function logfireEvent(
  severity: 'info' | 'error',
  event: string,
  params: TelemetryParams,
) {
  const safeParams = sanitizeParams({
    app_surface: 'web',
    environment: process.env.NODE_ENV,
    route: currentRoute(),
    ...params,
  })

  try {
    if (severity === 'error') logfire.error(`telemetry.${event}`, safeParams)
    else logfire.info(`telemetry.${event}`, safeParams)
  } catch {
    // Telemetry must never affect the user flow.
  }

  return safeParams
}

export function track(event: string, params: TelemetryParams = {}) {
  if (typeof window === 'undefined') return

  const safeEvent = EVENT_NAME_PATTERN.test(event) ? event : 'telemetry_invalid_event'
  const safeParams = logfireEvent('info', safeEvent, params)

  window.gtag?.('event', safeEvent, safeParams)
}

export function trackAction(
  action: string,
  outcome: ActionOutcome,
  params: TelemetryParams = {},
) {
  const safeParams = {
    action,
    outcome,
    ...params,
  }
  track(`${action}_${outcome}`, safeParams)

  if (outcome === 'failure') {
    logfireEvent('error', 'action_failure', safeParams)
  }
}

export function trackClientError(source: string, error?: unknown) {
  const errorType = error instanceof Error && error.name ? error.name : 'Error'
  const params = {
    source,
    error_type: errorType,
  }
  track('client_error', params)
  try {
    const safeError = new Error(errorType)
    safeError.name = errorType
    logfire.reportError(`telemetry.client.${source}`, safeError, sanitizeParams(params))
  } catch {
    // Telemetry must never affect the user flow.
  }
}

export function trackScreenView(pathname: string) {
  track('screen_view', {
    screen_name: pathname,
    page_path: pathname,
    query_present: typeof window !== 'undefined' && window.location.search.length > 0,
  })
}

export function trackNavigation(label: string, destination: string) {
  track('navigation_click', {
    navigation_label: label,
    destination,
  })
}
