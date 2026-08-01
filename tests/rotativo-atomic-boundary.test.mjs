import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const actions = readFileSync(
  new URL('../src/modules/rotativos/actions/rotativoActions.ts', import.meta.url),
  'utf8',
)
const repository = readFileSync(
  new URL('../src/modules/rotativos/repositories/SupabaseRotativoRepository.ts', import.meta.url),
  'utf8',
)
const creditTab = readFileSync(
  new URL('../src/modules/rotativos/components/CreditosTab.tsx', import.meta.url),
  'utf8',
)

test('rotativo financial actions delegate to atomic RPC-backed repository methods', () => {
  assert.match(actions, /repo\.enrollAthleteAtomic\(/)
  assert.match(actions, /repo\.purchaseCreditsAtomic\(/)
  assert.match(actions, /repo\.savePacotes\(/)
  assert.match(actions, /repo\.quoteCreditPurchaseValue\(/)
  assert.match(actions, /assertArenaBackofficeAccess\(arenaId\)[\s\S]{0,120}assertRotativoAccess\(rotativoId, arenaId\)/)
  assert.doesNotMatch(actions, /SupabaseFinanceRepository/)
  assert.doesNotMatch(actions, /calculateCreditPurchaseValue/)
  assert.doesNotMatch(actions, /operationId:\s*crypto\.randomUUID\(\)/)
})

test('credit modal preserves one operation id across failures and rotates it on close', () => {
  assert.match(creditTab, /const creditOperationId = useRef<string \| null>\(null\)/)
  assert.match(creditTab, /operationId: creditOperationId\.current/)
  assert.match(creditTab, /function closeCreditModal\(\)[\s\S]{0,100}creditOperationId\.current = null/)
  assert.match(creditTab, /if \(result\.success\)[\s\S]{0,140}closeCreditModal\(\)/)
})

test('rotativo repository has no direct financial DML saga', () => {
  const directFinancialWrite = /\.from\(['"](?:rotativo_inscricoes|rotativo_credito_lotes|rotativo_credito_movimentos|rotativo_pacotes|transactions)['"]\)[\s\S]{0,180}?\.(?:insert|update|delete)\(/
  assert.doesNotMatch(repository, directFinancialWrite)
  assert.match(repository, /enroll_backoffice_rotativo_athlete/)
  assert.match(repository, /purchase_backoffice_rotativo_credits/)
  assert.match(repository, /replace_backoffice_rotativo_packages/)
  assert.match(repository, /expire_backoffice_rotativo_credits/)
})

test('legacy registration action fails closed instead of trusting client price', () => {
  const legacyStart = actions.indexOf('export async function registerAthleteAction')
  const legacyEnd = actions.indexOf('export async function getRotativoCourtsAction')
  assert.notEqual(legacyStart, -1)
  assert.notEqual(legacyEnd, -1)

  const legacyAction = actions.slice(legacyStart, legacyEnd)
  assert.match(legacyAction, /Fluxo legado desabilitado/)
  assert.doesNotMatch(legacyAction, /repo\.registerAthlete|enrollAthleteAtomic|\.from\(/)
})
