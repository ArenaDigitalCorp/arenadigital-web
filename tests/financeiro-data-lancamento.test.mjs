import assert from 'node:assert/strict'
import test from 'node:test'

import { formatLaunchDate, lancamentoSoData } from '../src/lib/format.ts'

// launch_date mistura "só data" (meia-noite UTC: mensalidade, reserva, manual)
// e instante (now(): comanda, rotativo) — mesma regra de get_arena_finance_* no banco.

test('meia-noite UTC é lançamento só data e mostra o próprio dia', () => {
  assert.equal(lancamentoSoData('2026-12-01T00:00:00+00:00'), true)
  // Em Brasília isso seria 30/11 às 21h — o Financeiro mostrava um dia antes.
  assert.equal(formatLaunchDate('2026-12-01T00:00:00+00:00'), '01/12/2026')
})

test('instante real (now()) não é tratado como data', () => {
  assert.equal(lancamentoSoData('2026-12-01T01:30:00+00:00'), false)
  assert.equal(lancamentoSoData('2026-12-01T00:00:00.123+00:00'), false)
})

test('vazio ou inválido', () => {
  assert.equal(lancamentoSoData(null), false)
  assert.equal(formatLaunchDate(null), '—')
})
