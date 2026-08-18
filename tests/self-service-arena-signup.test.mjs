import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('email callback fails closed and routes ownership reviews to the status page', async () => {
  const [callback, signup] = await Promise.all([
    source('src/app/auth/callback/route.ts'),
    source('src/components/auth/CustomSignUp.tsx'),
  ])

  assert.match(callback, /if \(!provision\.success\)[\s\S]*?return observation\.respond/)
  assert.match(callback, /\['claim_pending', 'access_conflict', 'rejected'\]/)
  assert.match(callback, /new URL\('\/sign-up\/status'/)
  assert.ok(callback.indexOf('signup_requires_review') < callback.indexOf('ensureWebBackofficeAccessAction()'))
  assert.match(signup, /a propriedade será confirmada pela nossa equipe/)
})

test('password login preserves the authenticated session while a claim is awaiting review', async () => {
  const signIn = await source('src/app/sign-in/[[...sign-in]]/page.tsx')
  const pendingBranch = signIn.slice(signIn.indexOf("['claim_pending'"), signIn.indexOf('const webAccess'))

  assert.match(pendingBranch, /window\.location\.replace\('\/sign-up\/status'\)/)
  assert.doesNotMatch(pendingBranch, /signOut/)
})

test('status page exposes only a sanitized ownership state and supports sign out', async () => {
  const [statusPage, middleware] = await Promise.all([
    source('src/app/sign-up/status/page.tsx'),
    source('src/lib/supabase/middleware.ts'),
  ])

  assert.match(statusPage, /getSelfServiceArenaSignupStatus/)
  assert.match(statusPage, /signup\.status === 'provisioned'/)
  assert.match(statusPage, /href="\/auth\/sign-out"/)
  assert.doesNotMatch(statusPage, /signup\.(document|cpf|cnpj)|cpf_cnpj|arenaDocument/)
  assert.match(middleware, /isSignupReviewPath = pathname === '\/sign-up\/status'/)
  assert.match(middleware, /isAuthPath && !isSignupReviewPath && user/)
})

test('superadmin review starts the trial only after an approved claim', async () => {
  const [actions, queue] = await Promise.all([
    source('src/modules/platform-admin/actions/platformAdminActions.ts'),
    source('src/modules/platform-admin/components/ArenaClaimRequestsCard.tsx'),
  ])
  const start = actions.indexOf('export async function reviewArenaClaimRequestAction')
  const end = actions.indexOf('export async function searchEligibleArenaOwnersAction', start)
  const review = actions.slice(start, end)

  assert.match(review, /assertPlatformSuperAdminAccess\(\)/)
  assert.match(review, /rpc\('review_arena_claim_request'/)
  assert.match(review, /parsed\.decision === 'approve'/)
  assert.match(review, /ensureExperimentalSubscription\(/)
  assert.match(review, /trial\.reason === 'plan_not_found'/)
  assert.match(review, /observer\.complete\('completed',[\s\S]*?request_id:/)
  assert.doesNotMatch(review, /requester_email|submitted_arena_name|document/)
  assert.match(queue, /sem duplicar arenas que já existem no catálogo/)
  assert.match(queue, /Aprovar vínculo/)
})
