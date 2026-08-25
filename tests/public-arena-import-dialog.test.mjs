import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

function sourceSection(contents, startMarker, endMarker) {
  const start = contents.indexOf(startMarker)
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`)

  const end = contents.indexOf(endMarker, start + startMarker.length)
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`)
  return contents.slice(start, end)
}

test('existing batches resume in review with only ready arenas preselected', async () => {
  const dialog = await source('src/modules/platform-admin/components/PublicArenaImportDialog.tsx')
  const resumeBatch = sourceSection(
    dialog,
    'async function loadExistingBatch',
    'const readyIds = useMemo',
  )

  assert.match(dialog, /getPublicArenaImportBatchAction,/u)
  assert.match(dialog, /useState<Step>\(batchId \? "review" : "source"\)/u)
  assert.match(resumeBatch, /await getPublicArenaImportBatchAction\(existingBatchId\)/u)
  assert.match(resumeBatch, /setBatch\(result\.batch\)/u)
  assert.match(
    resumeBatch,
    /setSelected\(new Set\(result\.batch\.items\.filter\(\(item\) => item\.status === "ready"\)\.map\(\(item\) => item\.id\)\)\)/u,
  )
  assert.match(resumeBatch, /setStep\("review"\)/u)
})

test('new imports follow source, preview and review while renewing their operation id', async () => {
  const dialog = await source('src/modules/platform-admin/components/PublicArenaImportDialog.tsx')
  const loadCsv = sourceSection(dialog, 'async function loadCsv', 'async function loadMunicipalities')
  const stage = sourceSection(dialog, 'function stage()', 'function applySelected()')
  const reset = sourceSection(dialog, 'function resetImportData()', 'function handleOpenChange')

  assert.match(dialog, /const STEP_ORDER: Step\[\] = \["source", "preview", "review"\]/u)
  assert.match(dialog, /useState<Step>\(batchId \? "review" : "source"\)/u)
  assert.match(loadCsv, /setStep\("preview"\)/u)
  assert.match(stage, /setStep\("review"\)/u)
  assert.match(stage, /operationId: operationId\.current/u)
  assert.match(reset, /setStep\(batchId \? "review" : "source"\)/u)
  assert.match(reset, /operationId\.current = crypto\.randomUUID\(\)/u)
  assert.match(dialog, /if \(!nextOpen\) \{[\s\S]*?resetImportData\(\)/u)
})

test('staging and selective apply notify the batch owner and preserve hidden catalog semantics', async () => {
  const dialog = await source('src/modules/platform-admin/components/PublicArenaImportDialog.tsx')
  const stage = sourceSection(dialog, 'function stage()', 'function applySelected()')
  const applySelected = sourceSection(dialog, 'function applySelected()', 'function toggleAllReady()')

  assert.match(
    stage,
    /setSelected\(new Set\(result\.batch\.items\.filter\(\(item\) => item\.status === "ready"\)\.map\(\(item\) => item\.id\)\)\)/u,
  )
  assert.match(stage, /onBatchChange\?\.\(result\.batch\)/u)
  assert.match(applySelected, /itemIds: \[\.\.\.selected\]/u)
  assert.match(applySelected, /onBatchChange\?\.\(result\.batch\)/u)
  assert.match(dialog, /disabled=\{item\.status !== "ready"\}/u)
  assert.match(dialog, /if \(checked\) next\.add\(item\.id\)[\s\S]*?else next\.delete\(item\.id\)/u)
  assert.match(dialog, /As arenas serão adicionadas[\s\S]*?<strong[^>]*>ocultas<\/strong>, sem cliente, assinatura ou quadra\./u)
  assert.match(dialog, /As arenas foram adicionadas ao catálogo e continuam ocultas no app\./u)
})

test('review keeps audit context visible and handles completed batches without a zero-action CTA', async () => {
  const dialog = await source('src/modules/platform-admin/components/PublicArenaImportDialog.tsx')
  const applySelected = sourceSection(dialog, 'function applySelected()', 'function toggleAllReady()')

  assert.match(dialog, /Motivo para auditoria desta aplicação/u)
  assert.match(applySelected, /if \(reason\.trim\(\)\.length < 8\)/u)
  assert.match(applySelected, /const previousAppliedCount = batch\.counts\.applied/u)
  assert.match(applySelected, /const appliedNow = Math\.max\(0, result\.batch\.counts\.applied - previousAppliedCount\)/u)
  assert.match(dialog, /readyIds\.length === 0/u)
  assert.match(dialog, /Lote concluído/u)
  assert.match(dialog, /Esportes que serão associados a todas as arenas encontradas/u)
  assert.doesNotMatch(dialog, /Esportes encontrados no local/u)
  assert.match(dialog, /onClick=\{\(\) => void loadExistingBatch\(batchId\)\}/u)
})
