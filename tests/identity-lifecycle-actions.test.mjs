import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

function exportedFunctionBody(contents, functionName) {
  const start = contents.indexOf(`export async function ${functionName}`)
  assert.notEqual(start, -1, `${functionName} must exist`)
  const next = contents.indexOf('\nexport async function ', start + 1)
  return contents.slice(start, next === -1 ? contents.length : next)
}

test('arena user deletion delegates membership and identity cleanup to one transaction', async () => {
  const contents = await readFile(
    new URL('../src/modules/users/actions/userActions.ts', import.meta.url),
    'utf8',
  )
  const deletion = exportedFunctionBody(contents, 'deleteArenaUserAction')

  assert.match(deletion, /assertArenaAdminAccess\(arenaId\)/)
  assert.match(deletion, /rpc\('remove_arena_user_membership_atomic'/)
  assert.doesNotMatch(deletion, /from\('arena_users'\)\s*\.delete/)
  assert.doesNotMatch(deletion, /auth\.admin\.deleteUser/)
})
