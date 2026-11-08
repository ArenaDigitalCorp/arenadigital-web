import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const [editPage, operationsPanel, arenaForm, bookingCard, cancellationCard, paymentCard] = await Promise.all([
  readFile(new URL('../src/app/dashboard/arenas/[id]/edit/page.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/arenas/components/ArenaBookingOperationsPanel.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/arenas/components/ArenaForm.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/arenas/components/ArenaAppBookingSettingsCard.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/arenas/components/ArenaCancellationPolicyCard.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/arenas/components/ArenaPixSplitSettingsCard.tsx', import.meta.url), 'utf8'),
])

test('Arena profile and receiving settings are separated into explicit tabs', () => {
  const formPosition = editPage.indexOf('<ArenaForm')
  const financialAccountPosition = editPage.indexOf('<ArenaFinancialAccountCard')
  const operationsPosition = editPage.indexOf('<ArenaBookingOperationsPanel')
  const bookingPosition = operationsPanel.indexOf('<ArenaAppBookingSettingsCard')
  const cancellationPosition = operationsPanel.indexOf('<ArenaCancellationPolicyCard')
  const paymentPosition = operationsPanel.indexOf('<ArenaPixSplitSettingsCard')

  assert.ok(formPosition >= 0)
  assert.ok(financialAccountPosition > formPosition)
  assert.ok(operationsPosition > financialAccountPosition)
  assert.match(editPage, /Dados da arena/u)
  assert.match(editPage, /Dados de recebimento/u)
  assert.ok(bookingPosition >= 0)
  assert.ok(cancellationPosition > bookingPosition)
  assert.ok(paymentPosition > cancellationPosition)
  assert.doesNotMatch(arenaForm, /name="app_booking_mode"/u)
})

test('mode saving and account provisioning remain separate actions', () => {
  assert.match(operationsPanel, /setArenaReceivingBookingModeAction/u)
  assert.match(bookingCard, /Salvar modalidade/u)
  assert.match(bookingCard, /solicitações pendentes não ocupam a agenda/u)
  assert.match(paymentCard, /Confirmar e iniciar cadastro/u)
  assert.match(paymentCard, /Salvar rascunho/u)
  assert.doesNotMatch(bookingCard, /createArenaAsaasSubaccountAction/u)
  assert.match(paymentCard, /onSubmit=\{handleCreateSubaccount\}/u)
})

test('policy and receiving are visually conditional without discarding in-progress form state', () => {
  assert.match(operationsPanel, /hidden=\{!onlineSelected\}/u)
  assert.match(operationsPanel, /onSettingsChange/u)
  assert.match(cancellationCard, /Política de cancelamento/u)
  assert.match(cancellationCard, /Salvar rascunho/u)
  assert.match(paymentCard, /Registro operacional/u)
  assert.match(paymentCard, /Documentos solicitados/u)
})
