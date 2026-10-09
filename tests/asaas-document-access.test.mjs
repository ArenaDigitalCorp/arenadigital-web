import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

class AuthorizationError extends Error {
  constructor(message, status = 403) { super(message); this.status = status }
}

function harness({ arenaError = null, platformError = null } = {}) {
  const calls = []
  const { assertArenaFinancialOnboardingAccess } = loadTypescriptModule(
    'src/modules/arenas/services/financial-onboarding-access.ts', {
      'server-only': {},
      '@/lib/server-auth': {
        AuthorizationError,
        async assertArenaAdminAccess(arenaId) {
          calls.push({ action: 'arena', arenaId })
          if (arenaError) throw arenaError
          return { dbUserId: 'actor-test' }
        },
        async assertPlatformSuperAdminAccess() {
          calls.push({ action: 'platform' })
          if (platformError) throw platformError
          return { dbUserId: 'platform-actor-test' }
        },
      },
    },
  )
  return { authorize: assertArenaFinancialOnboardingAccess, calls }
}

test('financial document access authorizes the requested arena and preserves the real actor', async () => {
  const { authorize, calls } = harness()
  const access = await authorize('arena-test')
  assert.equal(access.dbUserId, 'actor-test')
  assert.equal(access.source, 'arena_self_service')
  assert.deepEqual(calls, [{ action: 'arena', arenaId: 'arena-test' }])
})

test('cross-arena manager and athlete cannot gain access through a denied platform role', async () => {
  const arenaError = new AuthorizationError('Arena proibida')
  const { authorize, calls } = harness({ arenaError, platformError: new AuthorizationError('Plataforma proibida') })
  await assert.rejects(authorize('arena-foreign'), error => error === arenaError)
  assert.deepEqual(calls, [{ action: 'arena', arenaId: 'arena-foreign' }, { action: 'platform' }])
})

test('explicit super admin access retains its separate audit source', async () => {
  const { authorize } = harness({ arenaError: new AuthorizationError('Arena proibida') })
  const access = await authorize('arena-test')
  assert.equal(access.dbUserId, 'platform-actor-test')
  assert.equal(access.source, 'super_admin_backoffice')
})

for (const error of [new AuthorizationError('Login necessário', 401), new Error('Dependency unavailable')]) {
  test(`authentication or infrastructure failure does not attempt alternate role authorization (${error.status ?? 'dependency'})`, async () => {
    const { authorize, calls } = harness({ arenaError: error })
    await assert.rejects(authorize('arena-test'), thrown => thrown === error)
    assert.equal(calls.length, 1)
  })
}
