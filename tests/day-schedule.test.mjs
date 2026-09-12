import assert from 'node:assert/strict'
import test from 'node:test'

import {
  configFromTiers,
  countSlots,
  gapTierId,
  isOvernight,
  normalizeTiers,
  normalizeTime,
  slotShiftExample,
  splittableTierIndex,
  suggestSplitPoint,
  summarizeDay,
  tiersFromConfig,
} from '../src/modules/courts/lib/day-schedule.ts'
import {
  courtPriceDayToDayConfig,
  dayConfigToCourtPriceDay,
} from '../src/modules/courts/lib/price-table-editor.ts'

/**
 * A UI virou card + painel; a matemática saiu inteira de DayScheduleConfig para
 * lib/day-schedule. Estes testes travam o comportamento que o gestor percebe
 * como "o que eu configurei foi o que ficou salvo".
 */

const dia = (over = {}) => ({
  day: 'Terça-feira',
  enabled: true,
  startTime: '07:00',
  endTime: '23:00',
  price: 40,
  customPrices: [],
  ...over,
})

/** Dia da captura do gestor: 07:00–02:00 com faixas de 40, 50 e 60. */
const diaReal = () =>
  dia({
    startTime: '07:00',
    endTime: '02:00',
    price: 40,
    defaultTierId: gapTierId('07:00'),
    customPrices: [
      { id: 'b-16', start: '16:00', end: '20:00', price: 50 },
      { id: 'b-20', start: '20:00', end: '02:00', price: 60 },
    ],
  })

// ── Ida e volta: o que entra é o que sai ──────────────────────────────────

test('config → faixas → config preserva horários, valores e faixa padrão', () => {
  const antes = diaReal()
  const tiers = tiersFromConfig(antes)
  const depois = configFromTiers(antes, tiers)

  assert.equal(depois.price, 40, 'o preço base continua o da faixa padrão')
  assert.equal(depois.defaultTierId, gapTierId('07:00'))
  assert.deepEqual(
    depois.customPrices.map((c) => [c.start, c.end, c.price]),
    [['16:00', '20:00', 50], ['20:00', '02:00', 60]]
  )
})

test('a segunda leitura devolve exatamente as mesmas faixas (idempotente)', () => {
  const primeira = configFromTiers(diaReal(), tiersFromConfig(diaReal()))
  const segunda = configFromTiers(primeira, tiersFromConfig(primeira))

  assert.deepEqual(segunda.customPrices, primeira.customPrices)
  assert.equal(segunda.price, primeira.price)
  assert.equal(segunda.defaultTierId, primeira.defaultTierId)
})

test('a faixa padrão escolhida pelo gestor sobrevive à releitura', () => {
  const base = diaReal()
  const tiers = tiersFromConfig(base)
  // gestor marca a faixa da noite (20:00) como padrão
  const noite = tiers.find((t) => t.start === '20:00')
  const salvo = configFromTiers(base, tiers.map((t) => ({ ...t, isDefault: t.id === noite.id })))

  assert.equal(salvo.price, 60, 'o preço base passa a ser o da noite')
  assert.equal(salvo.defaultTierId, gapTierId('20:00'))

  const relido = tiersFromConfig(salvo)
  const padraoRelida = relido.find((t) => t.isDefault)
  assert.equal(padraoRelida.start, '20:00', 'continua a mesma faixa após reabrir a tela')
  assert.equal(padraoRelida.price, 60)
})

test('ida e volta pelo formato persistido (CourtPriceDay) não perde nada', () => {
  const config = diaReal()
  const persistido = dayConfigToCourtPriceDay(2, config)
  const devolta = courtPriceDayToDayConfig(persistido)

  assert.equal(devolta.startTime, '07:00')
  assert.equal(devolta.endTime, '02:00')
  assert.equal(devolta.price, 40)
  assert.deepEqual(
    devolta.customPrices.map((c) => [c.start, c.end, c.price]),
    [['16:00', '20:00', 50], ['20:00', '02:00', 60]]
  )
})

test('slotShiftTime atravessa a ida e volta', () => {
  const config = dia({ slotShiftTime: '17:00' })
  assert.equal(courtPriceDayToDayConfig(dayConfigToCourtPriceDay(2, config)).slotShiftTime, '17:00')
  assert.equal(dayConfigToCourtPriceDay(2, dia({ slotShiftTime: null })).slotShiftTime, null)
})

// ── Funcionamento que cruza a meia-noite ──────────────────────────────────

test('o dia que fecha de madrugada é reconhecido como +1 dia', () => {
  assert.equal(isOvernight(dia({ startTime: '07:00', endTime: '02:00' })), true)
  assert.equal(isOvernight(dia({ startTime: '07:00', endTime: '23:00' })), false)
})

test('faixa da madrugada não é descartada por parecer anterior à abertura', () => {
  const tiers = tiersFromConfig(diaReal())
  const ultima = tiers[tiers.length - 1]
  assert.equal(ultima.end, '02:00', 'a última faixa termina no fechamento, já no dia seguinte')
  assert.equal(ultima.price, 60)
})

test('as faixas cobrem o funcionamento inteiro, sem buraco nem sobreposição', () => {
  for (const config of [diaReal(), dia({ customPrices: [{ start: '19:00', end: '21:00', price: 90 }] })]) {
    const tiers = tiersFromConfig(config)
    assert.equal(tiers[0].start, config.startTime, 'começa na abertura')
    assert.equal(tiers[tiers.length - 1].end, config.endTime, 'termina no fechamento')
    for (let i = 0; i < tiers.length - 1; i++) {
      assert.equal(tiers[i].end, tiers[i + 1].start, 'cada faixa emenda na seguinte')
    }
  }
})

// ── Dados legados / corrompidos ───────────────────────────────────────────

test('faixa fora do funcionamento é descartada', () => {
  const tiers = tiersFromConfig(
    dia({ startTime: '08:00', endTime: '12:00', customPrices: [{ start: '20:00', end: '22:00', price: 99 }] })
  )
  assert.equal(tiers.length, 1)
  assert.equal(tiers[0].price, 40, 'sobra só a faixa padrão')
})

test('faixas sobrepostas: a segunda é descartada para manter a cadeia', () => {
  const tiers = tiersFromConfig(
    dia({
      customPrices: [
        { start: '10:00', end: '14:00', price: 50 },
        { start: '12:00', end: '16:00', price: 70 },
      ],
    })
  )
  assert.equal(tiers.filter((t) => t.price === 70).length, 0)
  for (let i = 0; i < tiers.length - 1; i++) {
    assert.equal(tiers[i].end, tiers[i + 1].start)
  }
})

test('dia sem faixa nenhuma vira uma faixa única do dia inteiro', () => {
  const tiers = tiersFromConfig(dia())
  assert.deepEqual(
    [tiers.length, tiers[0].start, tiers[0].end, tiers[0].isDefault],
    [1, '07:00', '23:00', true]
  )
})

test('defaultTierId apontando para faixa inexistente cai na primeira lacuna', () => {
  const tiers = tiersFromConfig(diaReal2({ defaultTierId: 'default-99:99' }))
  const padrao = tiers.filter((t) => t.isDefault)
  assert.equal(padrao.length, 1, 'sempre exatamente uma faixa padrão')
  assert.equal(padrao[0].start, '07:00')
})

function diaReal2(over) {
  return { ...diaReal(), ...over }
}

// ── Reclamp ao mexer no funcionamento ─────────────────────────────────────

test('encurtar o funcionamento reclampa as faixas para dentro', () => {
  const base = diaReal()
  const encurtado = { ...base, endTime: '18:00' }
  const tiers = normalizeTiers(tiersFromConfig(encurtado), encurtado)

  assert.equal(tiers[tiers.length - 1].end, '18:00')
  for (const t of tiers) {
    assert.ok(t.start < '18:01', `faixa ${t.start}-${t.end} ficou fora do funcionamento`)
  }
})

test('normalizeTiers com lista vazia devolve a faixa padrão do dia', () => {
  const config = dia()
  const tiers = normalizeTiers([], config)
  assert.equal(tiers.length, 1)
  assert.equal(tiers[0].isDefault, true)
  assert.equal(tiers[0].price, 40)
})

// ── Slots ─────────────────────────────────────────────────────────────────

test('contagem de slots em dia normal e em dia que vira a madrugada', () => {
  assert.equal(countSlots(dia({ startTime: '08:00', endTime: '12:00' })), 4)
  assert.equal(countSlots(dia({ startTime: '07:00', endTime: '02:00' })), 19)
})

test('dia fechado não conta slot', () => {
  assert.equal(countSlots(dia({ enabled: false })), 0)
})

test('slots deslocados para o :30 mudam a grade a partir do horário marcado', () => {
  // 08:00–12:00 com virada às 09:00 ⇒ 08:00, 09:30, 10:30, 11:30
  assert.equal(countSlots(dia({ startTime: '08:00', endTime: '12:00', slotShiftTime: '09:00' })), 4)
  assert.equal(slotShiftExample('17:00'), 'ex: 17:30–18:30, 18:30–19:30…')
  assert.equal(slotShiftExample(null), null)
})

// ── Dividir e remover faixa ───────────────────────────────────────────────

test('só divide faixa com 2h ou mais, e escolhe a maior', () => {
  const config = diaReal()
  const tiers = tiersFromConfig(config)
  const idx = splittableTierIndex(tiers, config)
  assert.notEqual(idx, -1)
  assert.equal(tiers[idx].start, '07:00', 'a faixa 07:00–16:00 é a maior')

  const curta = dia({ startTime: '08:00', endTime: '09:00' })
  assert.equal(splittableTierIndex(tiersFromConfig(curta), curta), -1, 'faixa de 1h não divide')
})

test('o ponto de divisão cai numa hora cheia no meio da faixa', () => {
  assert.equal(suggestSplitPoint({ start: '07:00', end: '16:00' }), '11:00')
  assert.equal(suggestSplitPoint({ start: '20:00', end: '02:00' }), '23:00', 'funciona na madrugada')
  assert.equal(suggestSplitPoint({ start: '08:00', end: '09:30' }), null)
})

// ── Horário digitado ──────────────────────────────────────────────────────

test('horário inválido digitado é recusado em vez de virar lixo', () => {
  assert.equal(normalizeTime('9:00'), '09:00', 'aceita sem zero à esquerda')
  assert.equal(normalizeTime('25:00'), null)
  assert.equal(normalizeTime('12:60'), null)
  assert.equal(normalizeTime(''), null)
  assert.equal(normalizeTime('abc'), null)
})

// ── Resumo do card ────────────────────────────────────────────────────────

test('o resumo do card bate com o que o painel mostra', () => {
  const s = summarizeDay(diaReal())
  assert.equal(s.tierCount, 3)
  assert.equal(s.minPrice, 40)
  assert.equal(s.maxPrice, 60)
  assert.equal(s.overnight, true)
  assert.equal(s.slots, 19)
})

test('a barra do card cobre a jornada inteira, sem sobra nem falta', () => {
  for (const config of [diaReal(), dia(), dia({ startTime: '22:00', endTime: '01:00' })]) {
    const soma = summarizeDay(config).segments.reduce((acc, s) => acc + s.share, 0)
    assert.ok(Math.abs(soma - 1) < 1e-9, `segmentos somaram ${soma}`)
  }
})

test('a proporção de cada segmento acompanha a duração da faixa', () => {
  // 07:00–16:00 (9h), 16:00–20:00 (4h), 20:00–02:00 (6h) de 19h totais
  const [manha, tarde, noite] = summarizeDay(diaReal()).segments
  assert.ok(manha.share > noite.share && noite.share > tarde.share)
  assert.ok(Math.abs(manha.share - 9 / 19) < 1e-9)
})

test('dia de preço único não quebra a escala de cor da barra', () => {
  const s = summarizeDay(dia())
  assert.equal(s.minPrice, s.maxPrice, 'spread zero — o card usa opacidade cheia')
  assert.equal(s.segments.length, 1)
})

// ── Invariante do payload de gravação ─────────────────────────────────────

test('o editor sempre tem os 7 dias, venha de onde vier', async () => {
  const { toEditorDays, copyDaysFrom, EDITOR_DAY_ORDER, priceTableFromLegacyDayConfig } =
    await import('../src/modules/courts/lib/price-table-editor.ts')

  // `saveDirtyTables` monta o payload com
  // `EDITOR_DAY_ORDER.map(dow => days.find(...)!)` — um dia faltando quebraria
  // a gravação em runtime. Estas são as três origens possíveis dos dias.
  const origens = {
    'tabela vinda do servidor sem dias': toEditorDays([]),
    'tabela com um dia só': toEditorDays([
      { diaSemana: 6, enabled: true, startTime: '08:00', endTime: '12:00', slotShiftTime: null, basePrice: 50, bands: [] },
    ]),
    'copiada da Padrão': copyDaysFrom({ days: toEditorDays([]) }),
    // A tabela derivada do day_config legado traz só os dias habilitados; quem
    // completa a semana é o toEditorDays de `toEditor` — é esse o limite real.
    'derivada de day_config legado': toEditorDays(
      priceTableFromLegacyDayConfig('c1', 'a1', [
        { day: 'Sábado', enabled: true, startTime: '08:00', endTime: '12:00', price: 50, customPrices: [] },
      ]).days
    ),
  }

  for (const [origem, days] of Object.entries(origens)) {
    assert.equal(days.length, 7, `${origem}: deveria ter 7 dias`)
    for (const dow of EDITOR_DAY_ORDER) {
      assert.ok(
        days.find((d) => d.diaSemana === dow),
        `${origem}: falta o dia ${dow}`
      )
    }
  }
})

test('copiar da Padrão limpa os ids das faixas (senão colidiriam no insert)', async () => {
  const { copyDaysFrom, toEditorDays } = await import('../src/modules/courts/lib/price-table-editor.ts')

  const padrao = {
    days: toEditorDays([
      {
        diaSemana: 2, enabled: true, startTime: '07:00', endTime: '23:00',
        slotShiftTime: null, basePrice: 40,
        bands: [{ id: 'faixa-existente', start: '19:00', end: '22:00', price: 60 }],
      },
    ]),
  }

  const copiados = copyDaysFrom(padrao)
  const terca = copiados.find((d) => d.diaSemana === 2)
  assert.equal(terca.bands.length, 1)
  assert.equal(terca.bands[0].id, undefined, 'a faixa copiada é uma faixa nova')
  assert.equal(terca.bands[0].price, 60, 'mas o valor é o mesmo')
})
