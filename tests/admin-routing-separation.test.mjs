import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('administrative identities land on their dedicated backoffice after authentication', async () => {
  const [actions, signIn, callback] = await Promise.all([
    source('src/modules/auth/actions/authActions.ts'),
    source('src/app/sign-in/[[...sign-in]]/page.tsx'),
    source('src/app/auth/callback/route.ts'),
  ])

  assert.match(actions, /platformAccessLevel === 'super_admin'[\s\S]{0,80}'\/admin\/overview'/)
  assert.match(actions, /platformAccessLevel === 'platform_admin'[\s\S]{0,80}'\/dashboard\/admin\/platform'/)
  assert.match(signIn, /webAccess\.data\?\.adminDestination \?\? redirectTo/)
  assert.match(callback, /webAccess\.data\?\.adminDestination \?\? next/)
  assert.match(callback, /next === '\/reset-password'/)
})
