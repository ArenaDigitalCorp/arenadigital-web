import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../src/modules/mobile-content/actions/mobileContentActions.ts', import.meta.url), 'utf8')
const component = readFileSync(new URL('../src/modules/mobile-content/components/MobileContentPageClient.tsx', import.meta.url), 'utf8')

function actionHarness({ denyAccess = false } = {}) {
  const writes = []
  const filters = []
  let isAuthorized = false
  const query = {
    update(payload) { assert.equal(isAuthorized, true); writes.push({ method: 'update', payload }); return this },
    insert(payload) { assert.equal(isAuthorized, true); writes.push({ method: 'insert', payload }); return this },
    eq(column, value) { filters.push([column, value]); return this },
    select() { return this },
    async single() { return { data: { id: 'saved' }, error: null } },
  }
  const cjsModule = { exports: {} }
  const auth = async () => { if (denyAccess) throw new Error('Acesso negado'); isAuthorized = true }
  const require = (path) => {
    if (path === 'next/cache') return { revalidatePath() {} }
    if (path === '@/lib/server-auth') return { assertArenaAdminAccess: auth, assertCourtAccess: auth }
    if (path === '@/lib/supabase-server') return { getSupabaseAdmin: () => ({ from: () => query }) }
    if (path === '../schemas/mobile-content-action.schema') return { arenaPromotionActionSchema: { parse: (input) => input } }
    throw new Error(`Unexpected import ${path}`)
  }
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(compiled, { module: cjsModule, exports: cjsModule.exports, require, Date, Error })
  return { action: cjsModule.exports.upsertArenaPromotionAction, writes, filters }
}

test('new announcement writes no prices even if legacy price input is sent', async () => {
  const harness = actionHarness()
  const result = await harness.action('arena-a', { title: 'Hoje, 19h às 20h', image_url: 'https://example.invalid/arte.png', price: 80, original_price: 100 })
  assert.equal(result.success, true)
  assert.equal(harness.writes[0].payload.price, null)
  assert.equal(harness.writes[0].payload.original_price, null)
  assert.equal(harness.writes[0].payload.arena_id, 'arena-a')
})

test('editing preserves omitted legacy description and all legacy prices, scoped to arena', async () => {
  const harness = actionHarness()
  await harness.action('arena-a', { id: 'announcement-a', title: 'Amanhã, 19h', image_url: 'https://example.invalid/arte.png', price: 1, original_price: 2 })
  const payload = harness.writes[0].payload
  assert.equal(Object.hasOwn(payload, 'description'), false)
  assert.equal(Object.hasOwn(payload, 'price'), false)
  assert.equal(Object.hasOwn(payload, 'original_price'), false)
  assert.deepEqual(harness.filters, [['id', 'announcement-a'], ['arena_id', 'arena-a']])
})

test('new announcement without an image and unauthorized writes are rejected', async () => {
  const missing = actionHarness()
  assert.equal((await missing.action('arena-a', { title: 'Hoje, 19h' })).success, false)
  assert.equal(missing.writes.length, 0)
  const denied = actionHarness({ denyAccess: true })
  assert.equal((await denied.action('arena-a', { title: 'Hoje, 19h', image_url: 'https://example.invalid/arte.png' })).success, false)
  assert.equal(denied.writes.length, 0)
})

test('announcement form contains only available time and image inputs', () => {
  const form = component.split('<form className="space-y-4" onSubmit={savePromotion}>')[1].split('</form>')[0]
  assert.match(form, /label="Horário disponível"/)
  assert.match(form, /label="Imagem"/)
  assert.equal((form.match(/<Input /g) ?? []).length, 2)
  assert.doesNotMatch(form, /Textarea|OptionSelect|Switch|Preço|Prioridade|Descrição/)
  assert.doesNotMatch(component, /promotion\.price|promotionDraft\.(price|original_price)/)
  assert.match(component, /court_id: null,[\s\S]*sport_id: null,[\s\S]*priority: 0,[\s\S]*active: true/)
})
