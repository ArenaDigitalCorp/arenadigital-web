import assert from 'node:assert/strict'
import test from 'node:test'

import {
  dayConfigNameFor,
  generateSlotsForDate,
  getSlotPrice,
} from '../src/modules/bookings/utils/court-slots.ts'
import {
  DAY_NAMES,
  EDITOR_DAY_ORDER,
  copyDaysFrom,
  courtPriceDayToDayConfig,
  dayConfigFromPriceDays,
  dayConfigToCourtPriceDay,
  draftPriceTables,
  priceTableFromLegacyDayConfig,
  toEditorDays,
} from '../src/modules/courts/lib/price-table-editor.ts'
import {
  resolveCourtPriceSuggestion,
  resolveSlotPrice,
} from '../src/modules/courts/lib/court-price-resolver.ts'

const ARENA = '11111111-1111-4111-8111-111111111111'
const COURT = '22222222-2222-4222-8222-222222222222'

// ── Semana de referência determinística (segunda → domingo) ────────────────
function nextMonday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1)
  return d
}
const MON = nextMonday()
const dayAt = (offset) => {
  const d = new Date(MON)
  d.setDate(d.getDate() + offset)
  return d
}
const nameAt = (offset) => dayConfigNameFor(dayAt(offset))
const at = (offset, hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  const d = dayAt(offset)
  d.setHours(h, m, 0, 0)
  return d
}

const translate = (dayConfig) =>
  priceTableFromLegacyDayConfig(COURT, ARENA, dayConfig).days

// ── Fixtures de `day_config` legado ────────────────────────────────────────

/** Semana comum: segunda com faixa de pico, terça lisa, quarta desabilitada. */
const LEGACY_BASIC = [
  {
    day: nameAt(0),
    enabled: true,
    startTime: '08:00',
    endTime: '23:00',
    price: 100,
    customPrices: [{ id: 'band-17', start: '17:00', end: '20:00', price: 120 }],
  },
  {
    day: nameAt(1),
    enabled: true,
    startTime: '06:00',
    endTime: '22:00',
    price: 90,
    customPrices: [],
  },
  {
    day: nameAt(2),
    enabled: false,
    startTime: '06:00',
    endTime: '23:00',
    price: 0,
    customPrices: [],
  },
]

/** Sexta 08:00 → 02:00 do sábado, com faixa que também cruza a meia-noite. */
const LEGACY_OVERNIGHT = [
  {
    day: nameAt(4),
    enabled: true,
    startTime: '08:00',
    endTime: '02:00',
    slotShiftTime: '19:00',
    price: 100,
    customPrices: [
      { start: '17:00', end: '20:00', price: 120 },
      { start: '20:00', end: '02:00', price: 150 },
    ],
  },
]

/** Sujeira que o leitor legado ignora: faixa sem fim, preço inválido, dia repetido. */
const LEGACY_DIRTY = [
  {
    day: nameAt(0),
    enabled: true,
    startTime: '08:00',
    endTime: '23:00',
    price: 100,
    customPrices: [
      { start: '17:00', end: '20:00', price: 120 },
      { start: '21:00', price: 200 },
      { start: '21:00', end: '22:00', price: 'abc' },
      { start: '9:00', end: '10:00', price: 130 },
    ],
  },
  {
    day: nameAt(0),
    enabled: true,
    startTime: '10:00',
    endTime: '12:00',
    price: 999,
    customPrices: [],
  },
  { day: 'Dia Inexistente', enabled: true, startTime: '08:00', endTime: '10:00', price: 50 },
  { day: nameAt(3), enabled: true, startTime: '25:00', endTime: '30:00', price: 70 },
]

// ── 1. Tradução do legado não perde dado ───────────────────────────────────

test('legado → tabela de preço preserva dias, horários, base e faixas', () => {
  const days = translate(LEGACY_BASIC)

  assert.equal(days.length, 2, 'só os dias habilitados viram linha')

  const seg = days.find((d) => d.diaSemana === dayAt(0).getDay())
  assert.equal(seg.enabled, true)
  assert.equal(seg.startTime, '08:00')
  assert.equal(seg.endTime, '23:00')
  assert.equal(seg.basePrice, 100)
  assert.deepEqual(seg.bands, [{ start: '17:00', end: '20:00', price: 120 }])

  const ter = days.find((d) => d.diaSemana === dayAt(1).getDay())
  assert.equal(ter.basePrice, 90)
  assert.deepEqual(ter.bands, [])
})

test('legado overnight preserva janela que cruza a meia-noite e slotShiftTime', () => {
  const [sex] = translate(LEGACY_OVERNIGHT)
  assert.equal(sex.startTime, '08:00')
  assert.equal(sex.endTime, '02:00')
  assert.equal(sex.slotShiftTime, '19:00')
  assert.equal(sex.bands.length, 2)
  assert.deepEqual(sex.bands[1], { start: '20:00', end: '02:00', price: 150 })
})

test('tradução descarta exatamente o que o leitor legado descarta', () => {
  const days = translate(LEGACY_DIRTY)

  // dia repetido: vence a primeira ocorrência
  const seg = days.find((d) => d.diaSemana === dayAt(0).getDay())
  assert.equal(seg.startTime, '08:00')
  assert.equal(seg.basePrice, 100)

  // faixa sem fim e preço não numérico são descartadas; hora sem zero à
  // esquerda ("9:00") é aceita pelo legado, então é preservada e normalizada
  assert.deepEqual(seg.bands, [
    { start: '17:00', end: '20:00', price: 120 },
    { start: '09:00', end: '10:00', price: 130 },
  ])

  // nome de dia desconhecido e horário inválido não viram linha
  assert.equal(days.length, 1)
})

test('day_config vazio, nulo ou não-array vira tabela sem dias', () => {
  for (const input of [[], null, undefined, {}, 'nope', 42]) {
    assert.deepEqual(translate(input), [], `entrada ${JSON.stringify(input)}`)
  }
})

// ── 2. Round-trip: nada se perde no caminho de volta ───────────────────────

test('round-trip legado → tabela → legado devolve a mesma grade', () => {
  for (const legacy of [LEGACY_BASIC, LEGACY_OVERNIGHT]) {
    const back = dayConfigFromPriceDays(toEditorDays(translate(legacy)))
    const expected = legacy
      .filter((d) => d.enabled)
      .map((d) => ({
        day: d.day,
        enabled: true,
        startTime: d.startTime,
        endTime: d.endTime,
        slotShiftTime: d.slotShiftTime ?? null,
        price: d.price,
        customPrices: (d.customPrices ?? []).map((c) => ({
          start: c.start,
          end: c.end,
          price: c.price,
        })),
      }))
    assert.deepEqual(back, expected)
  }
})

test('round-trip pelo editor (DayScheduleConfig) preserva o dia', () => {
  const [seg] = translate(LEGACY_BASIC)
  const asConfig = courtPriceDayToDayConfig(seg)
  assert.equal(asConfig.day, DAY_NAMES[seg.diaSemana])
  assert.equal(asConfig.price, seg.basePrice)
  assert.deepEqual(
    asConfig.customPrices.map(({ start, end, price }) => ({ start, end, price })),
    seg.bands
  )

  const back = dayConfigToCourtPriceDay(seg.diaSemana, asConfig)
  assert.deepEqual(back, { ...seg, bands: seg.bands.map((b) => ({ ...b })) })
})

test('toEditorDays completa os 7 dias sem alterar os habilitados', () => {
  const days = toEditorDays(translate(LEGACY_BASIC))
  assert.equal(days.length, 7)
  assert.deepEqual(
    days.map((d) => d.diaSemana),
    EDITOR_DAY_ORDER
  )
  assert.equal(days.filter((d) => d.enabled).length, 2)
  const seg = days.find((d) => d.diaSemana === dayAt(0).getDay())
  assert.equal(seg.basePrice, 100)
  assert.deepEqual(seg.bands, [{ start: '17:00', end: '20:00', price: 120 }])
})

// ── 3. Paridade de preço com o leitor legado, slot a slot ──────────────────

/**
 * A grade legada chama `getSlotPrice(dataDaColuna, slot)` — o slot de madrugada
 * de um funcionamento overnight continua na coluna do dia que abriu a janela.
 * O resolver novo recebe o instante absoluto, que nesse caso é o dia seguinte.
 */
function assertSlotParity(legacy, fallbackPrice, offsets) {
  const days = translate(legacy)
  let compared = 0
  let healed = 0

  for (const offset of offsets) {
    const gridDate = dayAt(offset)
    const config = legacy.find(
      (d) => d.day?.toLowerCase() === dayConfigNameFor(gridDate).toLowerCase()
    )
    const startMins = config
      ? Number(config.startTime.split(':')[0]) * 60 +
        Number(config.startTime.split(':')[1])
      : 0

    for (const slot of generateSlotsForDate(gridDate, legacy)) {
      const slotMins = slot.hour * 60 + slot.minute
      const instant = new Date(gridDate)
      instant.setHours(slot.hour, slot.minute, 0, 0)
      if (slotMins < startMins) instant.setDate(instant.getDate() + 1)

      const legacyPrice = getSlotPrice(gridDate, legacy, slot, fallbackPrice)
      const nextPrice = resolveSlotPrice(days, instant) ?? fallbackPrice

      // O leitor legado devolve NaN quando a faixa tem preço corrompido; a
      // tabela nova descarta a faixa e cai no valor base. É cura, não perda.
      if (!Number.isFinite(legacyPrice)) {
        assert.ok(
          Number.isFinite(nextPrice),
          `slot ${slot.hour}:00 devolveu NaN no legado e no novo modelo`
        )
        healed += 1
        continue
      }

      assert.equal(
        nextPrice,
        legacyPrice,
        `divergência no slot ${slot.hour}:${String(slot.minute).padStart(2, '0')} da coluna ${gridDate.toDateString()}`
      )
      compared += 1
    }
  }

  assert.ok(compared > 0, 'nenhum slot comparado')
  return { compared, healed }
}

test('paridade slot a slot com getSlotPrice — semana comum', () => {
  const { compared, healed } = assertSlotParity(LEGACY_BASIC, 55, [0, 1, 2, 3])
  assert.ok(compared >= 30, `poucos slots comparados: ${compared}`)
  assert.equal(healed, 0)
})

test('paridade slot a slot com getSlotPrice — funcionamento overnight', () => {
  const { compared, healed } = assertSlotParity(LEGACY_OVERNIGHT, 55, [4])
  assert.ok(compared >= 15, `poucos slots comparados: ${compared}`)
  assert.equal(healed, 0)
})

test('grade com sujeira: paridade total, exceto a faixa de preço corrompido', () => {
  const { compared, healed } = assertSlotParity(LEGACY_DIRTY, 55, [0])
  assert.ok(compared > 0)
  // só o slot das 21:00 (faixa com price:'abc') diverge — e para melhor
  assert.equal(healed, 1)
})

test('faixa com preço corrompido: legado devolve NaN, tabela nova cai na base', () => {
  const slot = { hour: 21, minute: 0 }
  const legacyPrice = getSlotPrice(dayAt(0), LEGACY_DIRTY, slot, 55)
  assert.ok(Number.isNaN(legacyPrice), 'o leitor legado devolve NaN hoje')

  const nextPrice = resolveSlotPrice(translate(LEGACY_DIRTY), at(0, '21:00'))
  assert.equal(nextPrice, 100, 'a tabela nova usa o preço base do dia')
})

test('janela com hora impossível (25:00) é descartada — legado gera slots fantasma', () => {
  const quinta = dayAt(3)
  // Hoje a grade legada renderiza 01:00–05:00 a partir de "25:00"–"30:00"
  const phantom = generateSlotsForDate(quinta, LEGACY_DIRTY)
  assert.ok(phantom.length > 0, 'o leitor legado ainda gera slots')
  assert.equal(getSlotPrice(quinta, LEGACY_DIRTY, phantom[0], 55), 70)

  // A tabela nova não importa o dia (Postgres também recusaria '25:00'::time)
  const days = translate(LEGACY_DIRTY)
  assert.equal(
    days.find((d) => d.diaSemana === quinta.getDay()),
    undefined
  )
  assert.equal(resolveSlotPrice(days, at(3, '01:00')), null)
})

// ── 4. Fora da grade: o novo resolver é neutro (0), não herda o preço do dia ─

test('fora da janela de funcionamento a sugestão é neutra', () => {
  const days = translate(LEGACY_BASIC)
  // 03:00 de segunda está fora de 08:00–23:00
  assert.equal(resolveSlotPrice(days, at(0, '03:00')), null)
  assert.equal(
    resolveCourtPriceSuggestion(days, 'hourly', at(0, '03:00'), at(0, '04:00')),
    0
  )
  // quarta está desabilitada
  assert.equal(resolveSlotPrice(days, at(2, '10:00')), null)
})

// ── 5. Sugestão do intervalo (o que alimenta a reserva) ────────────────────

test('hourly soma faixa a faixa dentro da janela', () => {
  const days = translate(LEGACY_BASIC)
  // 16:00–19:00 na segunda: 100 (16h) + 120 (17h) + 120 (18h)
  assert.equal(
    resolveCourtPriceSuggestion(days, 'hourly', at(0, '16:00'), at(0, '19:00')),
    340
  )
  // 2h totalmente na base
  assert.equal(
    resolveCourtPriceSuggestion(days, 'hourly', at(0, '10:00'), at(0, '12:00')),
    200
  )
})

test('hourly rateia a última hora parcial', () => {
  const days = translate(LEGACY_BASIC)
  // 10:00–11:30 = 100 + 50
  assert.equal(
    resolveCourtPriceSuggestion(days, 'hourly', at(0, '10:00'), at(0, '11:30')),
    150
  )
})

test('unique devolve o valor fixo da faixa do início, sem multiplicar', () => {
  const days = translate(LEGACY_BASIC)
  assert.equal(
    resolveCourtPriceSuggestion(days, 'unique', at(0, '10:00'), at(0, '13:00')),
    100
  )
  assert.equal(
    resolveCourtPriceSuggestion(days, 'unique', at(0, '17:00'), at(0, '22:00')),
    120
  )
})

test('overnight: intervalo que cruza a meia-noite usa a janela de sexta', () => {
  const days = translate(LEGACY_OVERNIGHT)
  // sexta 23:00 → sábado 01:00, ambas as horas na faixa 20:00–02:00 (150)
  assert.equal(
    resolveCourtPriceSuggestion(days, 'hourly', at(4, '23:00'), at(5, '01:00')),
    300
  )
  // 19:00 → 21:00 = 120 (faixa 17–20) + 150 (faixa 20–02)
  assert.equal(
    resolveCourtPriceSuggestion(days, 'hourly', at(4, '19:00'), at(4, '21:00')),
    270
  )
})

test('intervalo inválido ou tabela vazia devolve 0', () => {
  const days = translate(LEGACY_BASIC)
  assert.equal(
    resolveCourtPriceSuggestion(days, 'hourly', at(0, '12:00'), at(0, '10:00')),
    0
  )
  assert.equal(
    resolveCourtPriceSuggestion(days, 'hourly', at(0, '10:00'), at(0, '10:00')),
    0
  )
  assert.equal(
    resolveCourtPriceSuggestion([], 'hourly', at(0, '10:00'), at(0, '11:00')),
    0
  )
  assert.equal(
    resolveCourtPriceSuggestion(null, 'hourly', at(0, '10:00'), at(0, '11:00')),
    0
  )
})

// ── 6. Rascunho do cadastro e cópia entre tabelas ──────────────────────────

test('draftPriceTables entrega as 3 fixas vazias, só a Padrão is_default', () => {
  const tables = draftPriceTables(ARENA)
  assert.deepEqual(
    tables.map((t) => t.tipo),
    ['padrao', 'mensalista', 'professor']
  )
  assert.equal(tables.filter((t) => t.isDefault).length, 1)
  assert.equal(tables.find((t) => t.isDefault).tipo, 'padrao')
  for (const t of tables) {
    assert.deepEqual(t.days, [], `${t.tipo} nasce vazia`)
    assert.equal(t.ativo, true)
    assert.equal(t.arenaId, ARENA)
  }
  // O editor ainda assim mostra os 7 dias desabilitados
  assert.equal(toEditorDays(tables[1].days).filter((d) => d.enabled).length, 0)
})

test('copiar da Padrão leva horários, base e faixas — e não leva ids', () => {
  const padrao = priceTableFromLegacyDayConfig(COURT, ARENA, LEGACY_BASIC)
  const copied = copyDaysFrom(padrao)

  assert.equal(copied.length, 7)
  const seg = copied.find((d) => d.diaSemana === dayAt(0).getDay())
  assert.equal(seg.enabled, true)
  assert.equal(seg.startTime, '08:00')
  assert.equal(seg.basePrice, 100)
  assert.deepEqual(seg.bands, [{ start: '17:00', end: '20:00', price: 120, id: undefined }])
  for (const day of copied) {
    assert.equal(day.id, undefined, 'dia copiado não carrega id')
    for (const band of day.bands) assert.equal(band.id, undefined)
  }

  // A cópia precifica igual à origem
  const copiedDays = copied.filter((d) => d.enabled)
  assert.equal(
    resolveCourtPriceSuggestion(copiedDays, 'hourly', at(0, '16:00'), at(0, '19:00')),
    resolveCourtPriceSuggestion(padrao.days, 'hourly', at(0, '16:00'), at(0, '19:00'))
  )
})

test('a cópia é independente da origem (sem alias de faixas)', () => {
  const padrao = priceTableFromLegacyDayConfig(COURT, ARENA, LEGACY_BASIC)
  const copied = copyDaysFrom(padrao)
  const seg = copied.find((d) => d.diaSemana === dayAt(0).getDay())
  seg.bands[0].price = 999
  seg.basePrice = 999
  assert.equal(padrao.days.find((d) => d.diaSemana === dayAt(0).getDay()).basePrice, 100)
  assert.equal(
    padrao.days.find((d) => d.diaSemana === dayAt(0).getDay()).bands[0].price,
    120
  )
})
