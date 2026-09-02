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

test('booking operations are grouped after the Arena profile form', () => {
  const formPosition = editPage.indexOf('<ArenaForm')
  const operationsPosition = editPage.indexOf('<ArenaBookingOperationsPanel')
  const bookingPosition = operationsPanel.indexOf('<ArenaAppBookingSettingsCard')
  const cancellationPosition = operationsPanel.indexOf('<ArenaCancellationPolicyCard')
  const paymentPosition = operationsPanel.indexOf('<ArenaPixSplitSettingsCard')

  assert.ok(formPosition >= 0)
  assert.ok(operationsPosition > formPosition)
  assert.ok(bookingPosition >= 0)
  assert.ok(cancellationPosition > bookingPosition)
  assert.ok(paymentPosition > cancellationPosition)
  assert.doesNotMatch(arenaForm, /name="app_booking_mode"/u)
})

test('app booking mode has an independent and explicit save journey', () => {
  assert.match(bookingCard, /updateArenaAppBookingModeAction/u)
  assert.match(bookingCard, /Salvar modalidade/u)
  assert.match(bookingCard, /requiresOnlineConfiguration = option\.value === "online_payment" && !onlineBookingReady/u)
  assert.match(bookingCard, /solicitações pendentes não ocupam a agenda/u)
  assert.match(paymentCard, /Somente ao confirmar estes dados criaremos a conta de pagamento/u)
  assert.doesNotMatch(bookingCard, /createArenaAsaasSubaccountAction/u)
  assert.match(paymentCard, /onSubmit=\{handleCreateSubaccount\}/u)
})

test('all operational cards share the same embedded visual hierarchy', () => {
  assert.match(operationsPanel, /divide-y divide-slate-200/u)
  assert.match(operationsPanel, /effectiveOnlineBookingReady/u)
  assert.match(operationsPanel, /onSettingsChange/u)
  assert.match(cancellationCard, /Configuração complementar/u)
  assert.match(cancellationCard, /Pré-reservas continuam disponíveis/u)
  assert.match(paymentCard, /Recebimento das reservas/u)
})
