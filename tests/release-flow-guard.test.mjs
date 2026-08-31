import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('release flow only promotes main to homolog and homolog to production', async () => {
  const workflow = await readFile(
    new URL('../.github/workflows/release-flow-guard.yml', import.meta.url),
    'utf8',
  )

  assert.match(workflow, /branches: \[main, homolog, production\]/u)
  assert.match(workflow, /homolog only accepts promotion pull requests from main/u)
  assert.match(workflow, /production only accepts promotion pull requests from homolog/u)
  assert.match(workflow, /main receives task branches, never an environment branch/u)
})
