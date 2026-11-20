import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { ARENA_TERMS_VERSION, ARENA_TERMS_URL } from '../src/modules/terms/arena-terms.ts'

// A receipt points to the content of a specific release. Publish substantive edits in a new file.
const fingerprints = {
  '2026-10-09': 'e7b2a39d6004f4de3d3e1e064ba92d5637a9259b68c9d3ba95fb4321da1cd41a',
  '2026-11-20': '484a110e5f8c2bee826da52e40b44a0ec079a66d1bedf7161a7819ab90fe0c94',
}

test('each archived release retains the complete text used in receipts', async () => {
  for (const [version, expected] of Object.entries(fingerprints)) {
    const bytes = await readFile(new URL(`../src/modules/terms/versions/${version}.json`, import.meta.url))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, version)
  }
  assert.ok(Object.hasOwn(fingerprints, ARENA_TERMS_VERSION))
  assert.equal(ARENA_TERMS_URL, `/termos-de-uso/${ARENA_TERMS_VERSION}`)
})
