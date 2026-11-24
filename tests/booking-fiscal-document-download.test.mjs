import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

const arenaId = '92bcaae1-9c2e-4942-a0f4-2b15d05c5c6c'
const invoiceId = '6ad9709e-cb1d-4c44-b86b-038afd30df8f'
const origin = 'https://fixture.example'
const signedUrl = `${origin}/storage/v1/object/sign/booking-fiscal-documents/${invoiceId}/invoice.pdf?token=signed`

class AuthorizationError extends Error {
  status = 403
}

function fixture({ forbidden = false, url = signedUrl, edgeStatus } = {}) {
  const calls = []
  const { POST } = loadTypescriptModule('src/app/api/finance/[arenaId]/notas-fiscais/download/route.ts', {
    '@/lib/server-auth': {
      AuthorizationError,
      async assertArenaResourceAccess(id, resource) {
        assert.equal(id, arenaId)
        assert.equal(resource, 'finance.overview')
        calls.push('auth')
        if (forbidden) throw new AuthorizationError()
      },
    },
    '@/lib/supabase/server': {
      async createSupabaseServerClient() {
        return {
          functions: {
            async invoke(name, { body }) {
              assert.equal(name, 'booking-fiscal-documents')
              assert.equal(body.invoiceId, invoiceId)
              assert.equal(body.format, 'pdf')
              calls.push('edge')
              return edgeStatus
                ? { data: null, error: { context: new Response(null, { status: edgeStatus }) } }
                : { data: { url }, error: null }
            },
          },
        }
      },
    },
  }, {
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: origin } },
    async fetch(target, options) {
      calls.push('storage')
      assert.equal(target.href, signedUrl)
      assert.equal(options.redirect, 'error')
      assert.equal(options.cache, 'no-store')
      return new Response('arquivo fiscal')
    },
  })
  return {
    calls,
    download: (format = 'pdf') => POST(new Request('https://web.example', {
      method: 'POST',
      body: JSON.stringify({ invoiceId, format }),
    }), { params: Promise.resolve({ arenaId }) }),
  }
}

test('proxies a verified private document only after finance access without exposing the signed URL', async () => {
  const { calls, download } = fixture()
  const response = await download()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal(response.headers.get('content-type'), 'application/pdf')
  assert.equal(response.headers.get('content-disposition'), `attachment; filename="nfse-${invoiceId}.pdf"`)
  assert.equal(response.headers.get('location'), null)
  assert.equal(await response.text(), 'arquivo fiscal')
  assert.deepEqual(calls, ['auth', 'edge', 'storage'])
})

test('invalid input and denied arena finance access never request a signed URL', async () => {
  const { calls, download } = fixture({ forbidden: true })
  assert.equal((await download('csv')).status, 400)
  assert.deepEqual(calls, [])
  assert.equal((await download()).status, 403)
  assert.deepEqual(calls, ['auth'])
})

test('unavailable documents and undeployed Edge routes return only a safe status', async () => {
  for (const [edgeStatus, expected] of [[404, 404], [409, 409], [500, 503]]) {
    const { calls, download } = fixture({ edgeStatus })
    const response = await download()
    assert.equal(response.status, expected)
    assert.equal(await response.text(), '')
    assert.deepEqual(calls, ['auth', 'edge'])
  }
})

test('rejects signed URLs outside the exact Supabase invoice scope before any fetch', async () => {
  for (const url of [
    signedUrl.replace(origin, 'https://untrusted.example'),
    signedUrl.replace('invoice.pdf', 'invoice.xml'),
    signedUrl.replace(invoiceId, arenaId),
    signedUrl.replace('/object/sign/', '/object/public/'),
    signedUrl.replace('?token=signed', ''),
  ]) {
    const { calls, download } = fixture({ url })
    assert.equal((await download()).status, 503)
    assert.deepEqual(calls, ['auth', 'edge'])
  }
})
