import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

const reportId = 'f9200000-0000-4000-8000-000000000001'

function fixture({ allowed = true, rows = [], error = null } = {}) {
  const calls = []
  const refreshed = []
  const actions = loadTypescriptModule('src/modules/athlete-moderation/actions.ts', {
    '@/lib/server-auth': { assertPlatformSuperAdminAccess: async () => { if (!allowed) throw new Error('Acesso negado') } },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => ({
      rpc: async (name, args) => { calls.push({ name, args }); return { data: rows, error } },
    }) },
    'next/cache': { revalidatePath: path => refreshed.push(path) },
  })
  return { ...actions, calls, refreshed }
}

test('moderation uses the authenticated administrative session for reads and writes', async () => {
  const denied = fixture({ allowed: false })
  await assert.rejects(denied.listContentReports('pending'), /Acesso negado/)
  await assert.rejects(denied.decideContentReport(reportId, 'hide', 'Decisão interna'), /Acesso negado/)
  assert.equal(denied.calls.length, 0)
})

test('keyset pagination returns the cursor of the last visible report and validates filters', async () => {
  const page = fixture({ rows: Array.from({ length: 26 }, (_, i) => ({ sequence_id: 101 - i })) })
  const result = await page.listContentReports('pending', 102)
  assert.equal(page.calls[0].args.p_limit, 26)
  assert.equal(page.calls[0].args.p_before, 102)
  assert.equal(result.rows.length, 25)
  assert.equal(result.next, 77)
  const last = fixture({ rows: [{ sequence_id: 76 }] })
  assert.equal((await last.listContentReports('pending', result.next)).next, null)
  await assert.rejects(last.listContentReports('unknown'))
  await assert.rejects(last.listContentReports('pending', -1))
  assert.equal(last.calls.length, 1)
})

test('decisions require a target and a reason, and preserve a failed review for retry', async () => {
  const review = fixture()
  assert.equal((await review.decideContentReport(reportId, 'hide', '  ')).ok, false)
  assert.equal((await review.decideContentReport(reportId, 'unrecognized', 'Nota')).ok, false)
  assert.equal(review.calls.length, 0)
  assert.equal((await review.decideContentReport(reportId, 'dismiss', ' Contexto verificado ')).ok, true)
  assert.equal(review.calls[0].name, 'review_athlete_content_report')
  assert.equal(review.calls[0].args.p_note, 'Contexto verificado')
  assert.deepEqual(review.refreshed, ['/admin/moderation'])
  const unavailable = fixture({ error: { message: 'Indisponível' } })
  assert.equal((await unavailable.decideContentReport(reportId, 'hide', 'Contexto verificado')).ok, false)
  assert.equal(unavailable.refreshed.length, 0)
})

test('the evidence link displays only a valid HTTPS destination without credentials', () => {
  const { reportMediaLink } = loadTypescriptModule('src/modules/athlete-moderation/model.ts')
  assert.equal(reportMediaLink(null), null)
  assert.equal(reportMediaLink('avatar.png'), null)
  assert.equal(reportMediaLink('http://example.org/image.jpg'), null)
  assert.equal(reportMediaLink('https://reviewer@example.org/image.jpg'), null)
  assert.equal(reportMediaLink('https://example.org/image.jpg'), 'https://example.org/image.jpg')
})
