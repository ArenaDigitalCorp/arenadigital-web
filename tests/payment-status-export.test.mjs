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
    'Data', 'Horário', 'Horas', 'Atleta', 'Serviço', 'Espaço', 'Esporte', 'Valor', 'Status',
  ])
  // Sem `fim`/`horas` (lançamento que não ocupa espaço por um intervalo) o
  // horário cai para o formatador de data e as horas ficam em branco. Sem
  // atleta cadastrado a coluna diz "Avulsa", não um travessão.
  assert.deepEqual(buildPaymentStatusSheetData(rows, () => '01/08/2026 10:45'), [
    ['Data', 'Horário', 'Horas', 'Atleta', 'Serviço', 'Espaço', 'Esporte', 'Valor', 'Status'],
    ['01/08/2026 10:45', '01/08/2026 10:45', '', 'Avulsa', 'Avulso', 'Quadra 1', '—', 149.9, 'Pago'],
  ])
})

test('payment report export carries the hour range and duration of a usage line', () => {
  const rows = [{
    id: 'booking-1-h0',
    data: '2026-09-01T19:00:00.000Z',
    fim: '2026-09-01T20:00:00.000Z',
    horas: 1,
    atleta: 'Professor Teste',
    servico: 'Mensal',
    espaco: 'Quadra 2',
    esporte: 'Beach Tennis',
    valor: 120,
    status: 'Pago',
  }]

  assert.deepEqual(
    buildPaymentStatusSheetData(rows, () => '01/09/2026', () => '16:00 às 17:00')[1],
    ['01/09/2026', '16:00 às 17:00', 1, 'Professor Teste', 'Mensal', 'Quadra 2', 'Beach Tennis', 120, 'Pago'],
  )
})

test('payment report shows the recurrence range on the mensalidade line, and never a phantom hour', async () => {
  const component = await readFile(
    new URL('../src/modules/reports/components/StatusPagamentosPageClient.tsx', import.meta.url),
    'utf8',
  )

  // O rótulo que o servidor manda (faixa da recorrência) vence a derivação por
  // instante; `null` explícito vira "—" em vez de virar hora de uma data.
  assert.match(component, /if \(row\.horario !== undefined\) return row\.horario \?\? '—'/u)

  const action = await readFile(
    new URL('../src/modules/reports/actions/reportActions.ts', import.meta.url),
    'utf8',
  )

  // Pagamento de mensalidade chega ao plano por um embed aninhado, sem consulta por linha.
  assert.match(action, /cobranca:cobranca_id\(mensalidade:mensalidade_id\(plano_id\)\)/u)
  // Plano com mais de um bloco não cabe numa faixa só.
  assert.match(action, /'Vários horários'/u)
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
