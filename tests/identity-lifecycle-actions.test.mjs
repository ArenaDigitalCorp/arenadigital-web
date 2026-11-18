import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

function exportedFunctionBody(contents, functionName) {
  const start = contents.indexOf(`export async function ${functionName}`)
  assert.notEqual(start, -1, `${functionName} must exist`)
  const next = contents.indexOf('\nexport async function ', start + 1)
  return contents.slice(start, next === -1 ? contents.length : next)
}

test('removing access removes only the expected arena membership', async () => {
  const contents = await readFile(
    new URL('../src/modules/users/actions/userActions.ts', import.meta.url),
    'utf8',
  )
  const deletion = exportedFunctionBody(contents, 'deleteArenaUserAction')

  assert.match(deletion, /await authorize\(arenaId\)/)
  assert.match(deletion, /accessRpc\('remove_arena_member_access'.*p_expected_member_id: arenaUserId/)
  assert.doesNotMatch(deletion, /from\('arena_users'\)\s*\.delete/)
  assert.doesNotMatch(deletion, /auth\.admin\.deleteUser/)
})
