import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const baselineFile = fileURLToPath(new URL('./migration-ownership-baseline.txt', import.meta.url))
const allowedLegacySql = new Set(
  readFileSync(baselineFile, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#')),
)

const trackedAndUntracked = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard'],
  { encoding: 'utf8' },
)
  .split(/\r?\n/u)
  .filter((file) => file.endsWith('.sql'))

const violations = trackedAndUntracked.filter((file) => !allowedLegacySql.has(file))

if (violations.length > 0) {
  console.error('Schema ownership violation: new SQL files are not allowed in arenadigital-web.')
  console.error('Create the migration in arenadigital-db/supabase/migrations instead:')
  for (const file of violations) console.error(`  - ${file}`)
  process.exit(1)
}

console.log(`Migration ownership guard passed (${trackedAndUntracked.length} legacy SQL file(s) allowed).`)
