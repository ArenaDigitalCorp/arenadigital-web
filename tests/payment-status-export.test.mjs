import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  PAYMENT_STATUS_EXPORT_HEADERS,
  buildPaymentStatusSheetData,
} from '../src/modules/reports/payment-status-export.ts'

test('payment report export preserves columns, text and numeric values', () => {
  const rows = [{
    id: 'payment-1',
    data: '2026-08-01T13:45:00.000Z',
    atleta: null,
    servico: 'Avulso',
    espaco: 'Quadra 1',
    esporte: null,
    valor: 149.9,
    status: 'Pago',
  }]

  assert.deepEqual(PAYMENT_STATUS_EXPORT_HEADERS, [
    'Data', 'Atleta', 'Serviço', 'Espaço', 'Esporte', 'Valor', 'Status',
  ])
  assert.deepEqual(buildPaymentStatusSheetData(rows, () => '01/08/2026 10:45'), [
    ['Data', 'Atleta', 'Serviço', 'Espaço', 'Esporte', 'Valor', 'Status'],
    ['01/08/2026 10:45', '—', 'Avulso', 'Quadra 1', '—', 149.9, 'Pago'],
  ])
})

test('payment report uses the safe browser-only writer and keeps the workbook contract', async () => {
  const component = await readFile(
    new URL('../src/modules/reports/components/StatusPagamentosPageClient.tsx', import.meta.url),
    'utf8',
  )

  assert.match(component, /import\('write-excel-file\/browser'\)/u)
  assert.match(component, /sheet: 'Status Pagamentos'/u)
  assert.match(component, /status-pagamentos-\$\{startDate\}-\$\{endDate\}\.xlsx/u)
  assert.doesNotMatch(component, /import\('xlsx'\)/u)
})
