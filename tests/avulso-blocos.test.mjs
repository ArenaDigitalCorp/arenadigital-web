import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  agruparBlocosAvulso,
  avaliarSlotAvulso,
  blocoAvulsoId,
  estaAbertoAvulso,
  fromDateKey,
  inicioDaSemana,
  intervaloDoBlocoAvulso,
  parseSlotKeyAvulso,
  podeSelecionarAvulso,
  slotKeyAvulso,
  toDateKey,
} from '../src/modules/bookings/lib/avulso-blocos.ts'

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')

// ── Chave do slot ─────────────────────────────────────────────────────────

test('slotKeyAvulso e parseSlotKeyAvulso fazem o caminho de ida e volta', () => {
  const key = slotKeyAvulso('quadra-1', '2026-09-22', 19)
  assert.equal(key, 'quadra-1|2026-09-22|19')
  assert.deepEqual(parseSlotKeyAvulso(key), {
    courtId: 'quadra-1',
    date: '2026-09-22',
    hora: 19,
  })
})

// ── Semana e datas ────────────────────────────────────────────────────────

test('inicioDaSemana volta ao domingo, mesmo já estando num domingo', () => {
  // 22/09/2026 é uma terça-feira.
  const terca = new Date(2026, 8, 22)
  const domingo = inicioDaSemana(terca)
  assert.equal(domingo.getDay(), 0)
  assert.equal(domingo.getDate(), 20)

  // Já estando no domingo, permanece nele.
  assert.equal(inicioDaSemana(domingo).getTime(), domingo.getTime())
})

test('toDateKey e fromDateKey fazem o caminho de ida e volta sem deslocar fuso', () => {
  const data = new Date(2026, 8, 22)
  const key = toDateKey(data)
  assert.equal(key, '2026-09-22')

  const volta = fromDateKey(key)
  assert.equal(volta.getFullYear(), 2026)
  assert.equal(volta.getMonth(), 8)
  assert.equal(volta.getDate(), 22)
})

// ── Agrupamento em blocos ─────────────────────────────────────────────────

test('horas seguidas do mesmo espaço e data viram um bloco só', () => {
  const blocos = agruparBlocosAvulso([
    slotKeyAvulso('quadra-1', '2026-09-22', 19),
    slotKeyAvulso('quadra-1', '2026-09-22', 20),
  ])

  assert.equal(blocos.length, 1)
  assert.deepEqual(
    { date: blocos[0].date, from: blocos[0].from, to: blocos[0].to },
    { date: '2026-09-22', from: 19, to: 21 }
  )
})

test('buraco entre as horas quebra em dois blocos', () => {
  const blocos = agruparBlocosAvulso([
    slotKeyAvulso('quadra-1', '2026-09-22', 9),
    slotKeyAvulso('quadra-1', '2026-09-22', 10),
    slotKeyAvulso('quadra-1', '2026-09-22', 19),
  ])

  assert.equal(blocos.length, 2)
  assert.deepEqual(blocos.map((b) => [b.from, b.to]), [
    [9, 11],
    [19, 20],
  ])
})

test('a mesma hora em espaços diferentes não se funde', () => {
  const blocos = agruparBlocosAvulso([
    slotKeyAvulso('quadra-1', '2026-09-22', 9),
    slotKeyAvulso('quadra-2', '2026-09-22', 9),
  ])

  assert.equal(blocos.length, 2)
  assert.deepEqual(new Set(blocos.map((b) => b.courtId)), new Set(['quadra-1', 'quadra-2']))
})

test('a mesma hora na mesma quadra em datas diferentes não se funde — cada data é uma reserva própria', () => {
  const blocos = agruparBlocosAvulso([
    slotKeyAvulso('quadra-1', '2026-09-22', 19),
    slotKeyAvulso('quadra-1', '2026-09-29', 19),
  ])

  assert.equal(blocos.length, 2)
  assert.deepEqual(new Set(blocos.map((b) => b.date)), new Set(['2026-09-22', '2026-09-29']))
})

test('blocos saem ordenados por data, depois por hora, depois por quadra', () => {
  const blocos = agruparBlocosAvulso([
    slotKeyAvulso('quadra-2', '2026-09-23', 10),
    slotKeyAvulso('quadra-1', '2026-09-22', 20),
    slotKeyAvulso('quadra-1', '2026-09-22', 9),
  ])

  assert.deepEqual(
    blocos.map((b) => `${b.date}|${b.from}|${b.courtId}`),
    ['2026-09-22|9|quadra-1', '2026-09-22|20|quadra-1', '2026-09-23|10|quadra-2']
  )
})

test('blocoAvulsoId identifica o bloco de forma estável, independente da ordem de inserção', () => {
  const bloco = { courtId: 'quadra-1', date: '2026-09-22', from: 19, to: 21, hours: [19, 20] }
  assert.equal(blocoAvulsoId(bloco), 'quadra-1|2026-09-22|19')
})

// ── Intervalo ISO do bloco ────────────────────────────────────────────────

test('intervaloDoBlocoAvulso converte a data concreta e as horas cheias em ISO', () => {
  const bloco = { courtId: 'quadra-1', date: '2026-09-22', from: 19, to: 21, hours: [19, 20] }
  const { startISO, endISO } = intervaloDoBlocoAvulso(bloco)

  const inicio = new Date(startISO)
  const fim = new Date(endISO)
  assert.equal(inicio.getFullYear(), 2026)
  assert.equal(inicio.getMonth(), 8)
  assert.equal(inicio.getDate(), 22)
  assert.equal(inicio.getHours(), 19)
  assert.equal(fim.getHours(), 21)
})

// ── Funcionamento do espaço ───────────────────────────────────────────────

const quadraAberta = {
  id: 'quadra-1',
  name: 'Quadra 1',
  day_config: [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ].map((day) => ({ day, enabled: true, startTime: '07:00', endTime: '23:00' })),
}

test('horário dentro do funcionamento está aberto', () => {
  // 22/09/2026 é terça-feira.
  assert.equal(estaAbertoAvulso(quadraAberta, new Date(2026, 8, 22), 19), true)
})

test('horário fora do funcionamento não está aberto', () => {
  assert.equal(estaAbertoAvulso(quadraAberta, new Date(2026, 8, 22), 2), false)
})

test('dia desabilitado no day_config não abre em nenhuma hora', () => {
  const fechadaTerca = {
    ...quadraAberta,
    day_config: quadraAberta.day_config.map((d) =>
      d.day === 'Terça-feira' ? { ...d, enabled: false } : d
    ),
  }
  assert.equal(estaAbertoAvulso(fechadaTerca, new Date(2026, 8, 22), 19), false)
})

test('funcionamento que cruza a meia-noite forma um intervalo circular', () => {
  const viraDia = {
    id: 'quadra-2',
    name: 'Quadra 2',
    day_config: [{ day: 'Terça-feira', enabled: true, startTime: '18:00', endTime: '02:00' }],
  }
  assert.equal(estaAbertoAvulso(viraDia, new Date(2026, 8, 22), 23), true, '23h está depois das 18h')
  assert.equal(estaAbertoAvulso(viraDia, new Date(2026, 8, 22), 1), true, '1h está antes das 2h')
  assert.equal(estaAbertoAvulso(viraDia, new Date(2026, 8, 22), 10), false, '10h está fora da janela')
})

// ── Avaliação da célula ───────────────────────────────────────────────────

test('horário sem reserva nenhuma fica livre', () => {
  const info = avaliarSlotAvulso({
    court: quadraAberta,
    date: new Date(2026, 8, 22),
    hora: 19,
    bookingsPorCourt: new Map(),
    agora: new Date(2026, 8, 22, 8, 0),
  })
  assert.equal(info.status, 'free')
})

test('horário ocupado por uma reserva existente fica busy, com o nome do ocupante', () => {
  const bookings = new Map([
    [
      'quadra-1',
      [
        {
          court_id: 'quadra-1',
          start_time: new Date(2026, 8, 22, 19, 0).toISOString(),
          end_time: new Date(2026, 8, 22, 20, 0).toISOString(),
          status: 'confirmed',
          athlete_name: 'Marina C.',
        },
      ],
    ],
  ])

  const info = avaliarSlotAvulso({
    court: quadraAberta,
    date: new Date(2026, 8, 22),
    hora: 19,
    bookingsPorCourt: bookings,
    agora: new Date(2026, 8, 22, 8, 0),
  })
  assert.equal(info.status, 'busy')
  assert.equal(info.occupantName, 'Marina C.')
})

test('reserva cancelada não bloqueia o horário', () => {
  const bookings = new Map([
    [
      'quadra-1',
      [
        {
          court_id: 'quadra-1',
          start_time: new Date(2026, 8, 22, 19, 0).toISOString(),
          end_time: new Date(2026, 8, 22, 20, 0).toISOString(),
          status: 'cancelled',
          athlete_name: 'Cancelada',
        },
      ],
    ],
  ])

  const info = avaliarSlotAvulso({
    court: quadraAberta,
    date: new Date(2026, 8, 22),
    hora: 19,
    bookingsPorCourt: bookings,
    agora: new Date(2026, 8, 22, 8, 0),
  })
  assert.equal(info.status, 'free')
})

test('fora do funcionamento do espaço fica closed', () => {
  const info = avaliarSlotAvulso({
    court: quadraAberta,
    date: new Date(2026, 8, 22),
    hora: 2,
    bookingsPorCourt: new Map(),
    agora: new Date(2026, 8, 22, 8, 0),
  })
  assert.equal(info.status, 'closed')
})

test('horário que já passou hoje fica past, mesmo estando livre e aberto', () => {
  const info = avaliarSlotAvulso({
    court: quadraAberta,
    date: new Date(2026, 8, 22),
    hora: 8,
    bookingsPorCourt: new Map(),
    agora: new Date(2026, 8, 22, 10, 0),
  })
  assert.equal(info.status, 'past')
})

test('o mesmo horário em outro dia da semana não fica past — só a data concreta importa', () => {
  const info = avaliarSlotAvulso({
    court: quadraAberta,
    date: new Date(2026, 8, 23),
    hora: 8,
    bookingsPorCourt: new Map(),
    agora: new Date(2026, 8, 22, 10, 0),
  })
  assert.equal(info.status, 'free')
})

test('só o status free pode ser selecionado', () => {
  assert.equal(podeSelecionarAvulso('free'), true)
  assert.equal(podeSelecionarAvulso('busy'), false)
  assert.equal(podeSelecionarAvulso('closed'), false)
  assert.equal(podeSelecionarAvulso('past'), false)
})

// ── Contrato com o BookingModal: por trás, continua criando reservas avulsas
// comuns — uma chamada da ação de sempre por bloco, com checagem de conflito
// por bloco antes de salvar, e as opções de reserva única (recorrência,
// serviço, cobrança separada) saindo do ar com mais de um bloco escolhido. ──

test('o salvamento multi-slot chama a mesma ação de sempre, uma vez por bloco', () => {
  const modal = read('../src/modules/bookings/components/BookingModal.tsx')

  assert.match(modal, /const handleSaveAvulsoMulti = async \(\) => \{/)
  const corpo = modal.slice(modal.indexOf('const handleSaveAvulsoMulti'))
  const inicioLoop = corpo.indexOf('for (const bloco of resumoBlocosAvulso)')
  const chamada = corpo.indexOf('await saveBackofficeBookingBundleAction(arenaId, {')
  assert.ok(inicioLoop !== -1 && chamada !== -1)
  assert.ok(chamada > inicioLoop, 'a chamada da ação tem que estar dentro do loop por bloco')

  // Cada chamada usa a quadra e o valor DO PRÓPRIO bloco — não uma quadra/valor fixos.
  const trechoDaChamada = corpo.slice(chamada, chamada + 500)
  assert.match(trechoDaChamada, /courtId: bloco\.courtId/)
  assert.match(trechoDaChamada, /rentalPrice: bloco\.valor/)
  assert.match(trechoDaChamada, /operationId: crypto\.randomUUID\(\)/)
})

test('a checagem de conflito roda por bloco, antes de salvar', () => {
  const modal = read('../src/modules/bookings/components/BookingModal.tsx')

  assert.match(modal, /async function handlePreSaveAvulsoMulti\(\) \{/)
  const corpo = modal.slice(modal.indexOf('async function handlePreSaveAvulsoMulti'))
  const inicioLoop = corpo.indexOf('for (const bloco of resumoBlocosAvulso)')
  const chamada = corpo.indexOf('await checkBookingConflictsAction(arenaId, bloco.courtId,')
  assert.ok(inicioLoop !== -1 && chamada !== -1)
  assert.ok(chamada > inicioLoop, 'a checagem de conflito tem que estar dentro do loop por bloco')
})

test('recorrência, serviço e cobrança separada saem do ar com mais de um bloco selecionado', () => {
  const modal = read('../src/modules/bookings/components/BookingModal.tsx')

  assert.match(
    modal,
    /const isMultiBlocoAvulso = !existingBooking && resumoBlocosAvulso\.length > 1/
  )
  // Efeito que zera os três toggles quando vira multi-bloco.
  const efeito = modal.slice(
    modal.indexOf('useEffect(() => {\n    if (!isMultiBlocoAvulso) return;')
  )
  assert.match(efeito, /setIsRecurring\(false\)/)
  assert.match(efeito, /setIncludeServices\(false\)/)
  assert.match(efeito, /setSplitBillingPerParticipant\(false\)/)
})

test('editar uma reserva existente nunca passa pelo fluxo multi-slot', () => {
  const modal = read('../src/modules/bookings/components/BookingModal.tsx')

  // A grade nova só aparece para reserva NOVA — editar continua nos campos legados.
  assert.match(modal, /\{!existingBooking && \(\s*<div className="space-y-2">\s*<div className="flex flex-wrap items-center gap-2">\s*<Label[^]*?Onde e quando/)
  assert.match(modal, /if \(bookingType === 'avulso' && !existingBooking\) \{\s*return handlePreSaveAvulsoMulti\(\);?\s*\}/)
})
