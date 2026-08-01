import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const packageJson = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
)

test('production scripts and runtime are pinned', () => {
  assert.equal(packageJson.private, true)
  assert.equal(packageJson.engines.node, '>=22.19.0 <23')
  assert.equal(packageJson.packageManager, 'pnpm@10.33.0')
  assert.equal(packageJson.scripts.build, 'next build')
  assert.equal(packageJson.scripts.start, 'next start')
  assert.ok(packageJson.scripts.typecheck)
  assert.ok(packageJson.scripts['guard:migration-ownership'])
  assert.match(packageJson.scripts['db:push'], /Bloqueado:/u)
  assert.doesNotMatch(packageJson.scripts['db:push'], /supabase\s+db\s+push/u)
})

test('critical framework versions are deterministic', () => {
  assert.match(packageJson.dependencies.next, /^\d+\.\d+\.\d+$/u)
  assert.match(packageJson.dependencies.react, /^\d+\.\d+\.\d+$/u)
  assert.match(packageJson.dependencies['react-dom'], /^\d+\.\d+\.\d+$/u)
})
