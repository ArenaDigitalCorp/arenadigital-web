import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

test('web telemetry uses OpenTelemetry and Logfire across server and browser', async () => {
  const [instrumentation, layout, clientInstrumentation, client, pageView, errorReporter, proxy, server] =
    await Promise.all([
      source('src/instrumentation.ts'),
      source('src/app/layout.tsx'),
      source('src/components/telemetry/ClientInstrumentation.tsx'),
      source('src/lib/telemetry/client.ts'),
      source('src/components/telemetry/TelemetryPageView.tsx'),
      source('src/components/telemetry/TelemetryErrorReporter.tsx'),
      source('src/proxy.ts'),
      source('src/lib/observability/server.ts'),
    ])

  assert.match(instrumentation, /registerOTel/)
  assert.match(layout, /ClientInstrumentation/)
  assert.match(clientInstrumentation, /@pydantic\/logfire-browser/)
  assert.match(clientInstrumentation, /@opentelemetry\/auto-instrumentations-web/)
  assert.match(clientInstrumentation, /logfire-proxy\/v1\/traces/)
  assert.match(client, /@pydantic\/logfire-browser/)
  assert.match(client, /reportError/)
  assert.match(pageView, /usePathname/)
  assert.match(errorReporter, /unhandledrejection/)
  assert.match(proxy, /LOGFIRE_TOKEN/)
  assert.match(proxy, /logfire-proxy\/v1\/traces/)
  assert.match(server, /startSpan/)
  assert.match(server, /logfire\.(info|warning|error)/)
})

test('browser telemetry explicitly allowlists dimensions and keeps the token server-side', async () => {
  const [client, clientInstrumentation, proxy] = await Promise.all([
    source('src/lib/telemetry/client.ts'),
    source('src/components/telemetry/ClientInstrumentation.tsx'),
    source('src/proxy.ts'),
  ])

  assert.match(client, /SAFE_PARAMETER_KEYS/)
  assert.match(client, /arena_id/)
  assert.match(client, /error_type/)
  assert.doesNotMatch(client, /email:/)
  assert.doesNotMatch(client, /password:/)
  assert.doesNotMatch(client, /\/api\/telemetry/)
  assert.doesNotMatch(client, /sendToServer/)
  assert.doesNotMatch(clientInstrumentation, /LOGFIRE_TOKEN/)
  assert.match(proxy, /LOGFIRE_TOKEN/)
})
