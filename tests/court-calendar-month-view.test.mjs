import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

/**
 * `CourtCalendarPageClient` não tem infra de render (sem RTL/jsdom no
 * projeto) — mesma limitação de `BookingModal`/`StatusPagamentosPageClient`,
 * cobertos por asserções de source. Aqui: a visão de Mês foi um acréscimo, não
 * susbtituiu Dia/Semana — os testes garantem as duas coisas.
 */
const read = () =>
  readFile(
    new URL('../src/modules/bookings/components/CourtCalendarPageClient.tsx', import.meta.url),
    'utf8',
  )

test('Dia e Semana continuam no seletor de visão — o Mês é um acréscimo', async () => {
  const component = await read()

  assert.match(component, />\s*Dia\s*<\/button>/u)
  assert.match(component, />\s*Semana\s*<\/button>/u)
  assert.match(component, />\s*Mês\s*<\/button>/u)
  assert.match(component, /handleViewMode\("day"\)/u)
  assert.match(component, /handleViewMode\("week"\)/u)
  assert.match(component, /handleViewMode\("month"\)/u)
})

test('a grade de hora a hora (Dia/Semana) permanece intacta', async () => {
  const component = await read()

  // O grid de slots por hora — TimeSlot — é exclusivo de Dia/Semana; a visão
  // de Mês usa outro layout. Se sumir daqui, a grade horária foi removida.
  assert.match(component, /<TimeSlot/u)
  assert.match(component, /slots\.map\(\(slot, slotIndex\)/u)
})

test('viewMode aceita "month" nos três lugares que decidem o que carregar/navegar', async () => {
  const component = await read()

  assert.match(component, /useState<'day' \| 'week' \| 'month'>\('day'\)/u)
  assert.match(component, /mode: 'day' \| 'week' \| 'month'/u)
})

test('trocar de mês recarrega a grade inteira do mês (semanas completas)', async () => {
  const component = await read()

  // A busca cobre a grade exibida (seg–dom da primeira à última semana do
  // mês), não só o intervalo 1º–30/31 — senão dias de outro mês na borda
  // ficariam sem os agendamentos que têm.
  assert.match(component, /startOfWeek\(startOfMonth\(date\), \{ weekStartsOn: 1 \}\)/u)
  assert.match(component, /endOfWeek\(endOfMonth\(date\), \{ weekStartsOn: 1 \}\)/u)
  assert.match(component, /subMonths\(currentDate, 1\)/u)
  assert.match(component, /addMonths\(currentDate, 1\)/u)
})

test('clicar num dia do mês abre a visão de Dia daquela data — clicar numa reserva não', async () => {
  const component = await read()

  assert.match(component, /setViewMode\("day"\)\s*\n\s*setCurrentDate\(day\)\s*\n\s*loadBookings\(day, "day"\)/u)
  // O chip da reserva impede a propagação — senão clicar nele também trocaria de visão.
  assert.match(component, /e\.stopPropagation\(\)\s*\n\s*setSelectedBooking\(b\)/u)
})
