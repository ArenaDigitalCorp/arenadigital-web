import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  caixaTotaisPorModo,
  isLancamentoAutomatico,
  origemDoLancamento,
  saldoEmDinheiro,
} from '../src/modules/finance/lib/caixa.ts'

const DINHEIRO = { modo_pagamento_id: 'd', modo_pagamento: { nome: 'Dinheiro em espécie' } }
const PIX = { modo_pagamento_id: 'p', modo_pagamento: { nome: 'Pix' } }

test('saldo do caixa conta só dinheiro; demais formas aparecem na quebra', () => {
  const totais = caixaTotaisPorModo([
    { type: 'entrada', total_value: 80, ...DINHEIRO },
    { type: 'entrada', total_value: 30, ...PIX },
    { type: 'saída', total_value: 20, ...DINHEIRO },
    { type: 'entrada', total_value: 5, modo_pagamento_id: null, modo_pagamento: null },
  ])

  assert.deepEqual(totais.map((t) => [t.nome, t.entradas, t.saidas]), [
    ['Dinheiro em espécie', 80, 20],
    ['Não informado', 5, 0],
    ['Pix', 30, 0],
  ])
  assert.equal(saldoEmDinheiro(50, totais), 110)
})

test('recebimentos automáticos são identificados pela origem', () => {
  assert.equal(isLancamentoAutomatico({ source_type: 'mensalista_pagamento' }), true)
  assert.equal(isLancamentoAutomatico({ source_type: null }), false)
  assert.equal(origemDoLancamento('booking_cobranca_pagamento'), 'Rateio')
  assert.equal(origemDoLancamento('station_payment'), 'Comanda')
  assert.equal(origemDoLancamento('estorno'), 'Estorno')
  assert.equal(origemDoLancamento('desconhecido'), 'Automático')
  assert.equal(origemDoLancamento(null), null)
})

test('caixa não oferece editar/excluir para lançamento automático', async () => {
  const caixaPage = await source('src/modules/finance/components/CaixaPageClient.tsx')
  assert.match(caixaPage, /isLancamentoAutomatico\(t\) \?[\s\S]{0,300}Automático[\s\S]{0,300}handleOpenEdit\(t\)/)
})

test('relatório de pagamentos ignora entradas estornadas', async () => {
  const reports = await source('src/modules/reports/actions/reportActions.ts')
  assert.match(reports, /\.eq\('source_type', 'estorno'\)/)
  assert.match(reports, /!estornados\.has\(t\.id\)/)
})

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

function exportedFunctionBody(contents, name) {
  const start = contents.indexOf(`export async function ${name}`)
  assert.ok(start >= 0, `${name} not found`)
  const next = contents.indexOf('\nexport ', start + 1)
  return next === -1 ? contents.slice(start) : contents.slice(start, next)
}

test('caixa session actions use assertArenaCaixaAccess and the caixa RPCs', async () => {
  const actions = await source('src/modules/finance/actions/caixaSessionActions.ts')

  for (const name of [
    'getCurrentCaixaSessionAction',
    'getCaixaSessionsHistoryAction',
    'getCaixaSessionDetailAction',
    'openCaixaSessionAction',
    'closeCaixaSessionAction',
  ]) {
    assert.match(exportedFunctionBody(actions, name), /assertArenaCaixaAccess\(arenaId\)/, `${name} must require caixa access`)
  }

  assert.match(exportedFunctionBody(actions, 'openCaixaSessionAction'), /rpc\('open_caixa_session'/)
  assert.match(exportedFunctionBody(actions, 'closeCaixaSessionAction'), /rpc\('close_caixa_session'/)
})

test('manual lançamento mutations go through the caixa RPCs, never a direct transactions write', async () => {
  const financeActions = await source('src/modules/finance/actions/financeActions.ts')

  assert.match(exportedFunctionBody(financeActions, 'createTransactionAction'), /rpc\('create_caixa_transaction'/)
  assert.match(exportedFunctionBody(financeActions, 'updateTransactionAction'), /rpc\('update_caixa_transaction'/)
  assert.match(exportedFunctionBody(financeActions, 'deleteTransactionAction'), /rpc\('delete_caixa_transaction'/)

  assert.doesNotMatch(exportedFunctionBody(financeActions, 'createTransactionAction'), /from\('transactions'\)\.insert/)
  assert.doesNotMatch(exportedFunctionBody(financeActions, 'updateTransactionAction'), /from\('transactions'\)\.update/)
  assert.doesNotMatch(exportedFunctionBody(financeActions, 'deleteTransactionAction'), /from\('transactions'\)\.delete/)
})

test('assertArenaCaixaAccess is any active arena member, not admin-restricted', async () => {
  const serverAuth = await source('src/lib/server-auth.ts')
  const start = serverAuth.indexOf('export async function assertArenaCaixaAccess')
  assert.ok(start >= 0)
  const body = serverAuth.slice(start, start + 200)
  assert.match(body, /return assertArenaAccess\(arenaId\)/)
  assert.doesNotMatch(body, /canAccessArenaBackoffice|canManageArena/)
})

test('fechamento de caixa só atualiza a UI depois de checar sucesso e presença dos dados', async () => {
  const caixaPage = await source('src/modules/finance/components/CaixaPageClient.tsx')
  assert.match(
    caixaPage,
    /closeCaixaSessionAction[\s\S]{0,220}if \(!result\.success \|\| !result\.data\) throw/,
  )
})
