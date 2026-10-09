import { loadTypescriptModule } from './load-typescript-module.mjs'

export const TEST_ARENA_ID = '11111111-1111-4111-8111-111111111111'
export const TEST_FOREIGN_ARENA_ID = '11111111-1111-4111-8111-111111111112'
export const TEST_ACTOR_ID = '33333333-3333-4333-8333-333333333333'
export const TEST_REQUEST_ID = '22222222-2222-4222-8222-222222222222'
export const TEST_SECOND_REQUEST_ID = '22222222-2222-4222-8222-222222222223'

class AuthorizationError extends Error {
  constructor(message, status = 403) { super(message); this.status = status }
}

export function documentInput(overrides = {}) {
  const bytes = new TextEncoder().encode('%PDF-synthetic-test-only')
  return {
    arenaId: TEST_ARENA_ID, actorId: TEST_ACTOR_ID, documentGroupId: 'group-test',
    requestId: TEST_REQUEST_ID, explicitRetry: false,
    file: new File([bytes], 'synthetic-test.pdf', { type: 'application/pdf' }),
    bytes,
    ...overrides,
  }
}

export function documentFlowHarness(options = {}) {
  const state = {
    attempts: new Map((options.attempts ?? []).map(attempt => [attempt.request_id, { ...attempt }])),
    groups: options.groups ?? [{ id: 'group-test', type: 'IDENTIFICATION', status: 'NOT_SENT' }],
    rpcCalls: [], providerRequests: [], authCalls: [], logs: [],
  }
  const rpcClient = {
    from(table) {
      if (table !== 'arena_payment_accounts') throw new Error('Unexpected table lookup')
      const query = {
        select() { return query },
        eq() { return query },
        async maybeSingle() {
          return { data: options.account ?? { updated_at: '2026-01-01T00:00:00.000Z', last_status_checked_at: '2026-01-01T00:00:00.000Z' }, error: null }
        },
      }
      return query
    },
    async rpc(name, args) {
      state.rpcCalls.push({ name, args })
      if (options.missingRpc) return { data: null, error: { code: 'PGRST202', message: 'synthetic-private-db-detail' } }
      if (options.dbDenied) return { data: null, error: { code: '42501', message: 'synthetic-private-db-detail' } }
      if (name === 'get_arena_asaas_document_uploads') return { data: [...state.attempts.values()], error: null }
      if (name === 'claim_arena_asaas_document_upload') {
        const previous = state.attempts.get(args.p_request_id)
        if (previous) {
          if (previous.content_sha256 !== args.p_content_sha256 || previous.document_type !== args.p_document_type || previous.document_group_id !== args.p_document_group_id) {
            return { data: null, error: { code: '22023', message: 'synthetic-private-conflict-detail' } }
          }
          return { data: { claimed: false, status: previous.status, request_id: previous.request_id, reason_code: previous.reason_code }, error: null }
        }
        const current = [...state.attempts.values()].find(attempt => attempt.document_group_id === args.p_document_group_id)
        if (current && (['processing', 'unknown'].includes(current.status) || !args.p_explicit_retry)) {
          return { data: { claimed: false, status: current.status, request_id: current.request_id,
            reason_code: ['processing', 'unknown'].includes(current.status) ? current.reason_code : 'explicit_retry_required' }, error: null }
        }
        if (current) state.attempts.delete(current.request_id)
        const attempt = {
          document_group_id: args.p_document_group_id, document_type: args.p_document_type,
          request_id: args.p_request_id, content_sha256: args.p_content_sha256, status: 'processing', reason_code: null,
        }
        state.attempts.set(args.p_request_id, attempt)
        return { data: { claimed: true, status: 'processing', request_id: args.p_request_id, reason_code: null }, error: null }
      }
      if (name === 'finish_arena_asaas_document_upload') {
        if (options.finishError) return { data: null, error: { code: 'synthetic-test-error', message: 'synthetic-private-db-detail' } }
        const attempt = state.attempts.get(args.p_request_id)
        attempt.status = args.p_outcome
        attempt.reason_code = args.p_reason_code
        return { data: { status: attempt.status, request_id: attempt.request_id, reason_code: attempt.reason_code }, error: null }
      }
      if (name === 'reconcile_arena_asaas_document_upload') {
        const attempt = [...state.attempts.values()].find(current => current.document_group_id === args.p_document_group_id)
        if (attempt) { attempt.status = 'submitted'; attempt.reason_code = 'provider_reconciled' }
        return { data: { reconciled: Boolean(attempt), status: attempt?.status ?? null, request_id: attempt?.request_id ?? null }, error: null }
      }
      throw new Error(`Unexpected RPC boundary in test: ${name}`)
    },
  }
  const [service, route] = loadTypescriptModule([
    'src/modules/arenas/services/asaas-documents.service.ts',
    'src/app/api/arenas/[arenaId]/asaas/documents/route.ts',
  ], {
    'server-only': {},
    '@/lib/supabase-server': { getSupabaseAdmin: () => rpcClient },
    '@/modules/arenas/services/asaas-baas.service': {
      loadSubaccountApiKey: async arenaId => {
        if (arenaId !== TEST_ARENA_ID) throw new Error('Unexpected credential scope')
        return 'synthetic-subaccount-test-only'
      },
      asaasBaseUrl: () => 'https://api-sandbox.asaas.com',
    },
    '@/lib/server-auth': {
      AuthorizationError,
      async assertArenaAdminAccess(arenaId) {
        state.authCalls.push(arenaId)
        if (options.unauthenticated) throw new AuthorizationError('synthetic-private-auth-detail', 401)
        if (arenaId !== TEST_ARENA_ID) throw new AuthorizationError('synthetic-private-cross-arena-detail')
        return { dbUserId: TEST_ACTOR_ID }
      },
      async assertPlatformSuperAdminAccess() { throw new AuthorizationError('Not a platform admin') },
    },
    '@/lib/observability/server': {
      observeHttpRequest: () => ({ respond: response => response, log: (...entry) => state.logs.push(entry) }),
    },
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
  }, {
    fetch: async (url, request) => {
      state.providerRequests.push({ url, request })
      if (request.method === 'POST') {
        if (options.uploadWait) await options.uploadWait
        if (options.uploadThrows) throw new Error('synthetic-private-provider-network-detail')
        return new Response(options.uploadBody ?? 'synthetic-private-provider-response', { status: options.uploadStatus ?? 200 })
      }
      return Response.json({ data: state.groups })
    },
  })
  return { ...state, state, service, route }
}

export function uploadRequest({ arenaId = TEST_ARENA_ID, origin = 'https://arena.example', modify = () => {} } = {}) {
  const input = documentInput()
  const body = new FormData()
  body.set('documentGroupId', input.documentGroupId)
  body.set('requestId', input.requestId)
  body.set('explicitRetry', 'false')
  body.set('documentFile', input.file)
  modify(body)
  return new Request(`https://arena.example/api/arenas/${arenaId}/asaas/documents`, { method: 'POST', headers: { origin }, body })
}

export function routeContext(arenaId = TEST_ARENA_ID) { return { params: Promise.resolve({ arenaId }) } }
