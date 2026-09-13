import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  agruparBlocos,
  avaliarSlot,
  fracaoPrimeiroMes,
  ocorrencias,
  resumirPlano,
  slotKey,
} from '../src/modules/bookings/lib/mensalista-blocos.ts'

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')

// O repo do banco é irmão; em CI do web ele pode não estar presente.
const DB_ROOT = fileURLToPath(new URL('../../../arenadigital-db/', import.meta.url))
const hasDbRepo = existsSync(DB_ROOT)
const readMigration = (name) => readFileSync(`${DB_ROOT}supabase/migrations/${name}`, 'utf8')

// ── Agrupamento em blocos ─────────────────────────────────────────────────

test('horas seguidas do mesmo espaço e dia viram um bloco só', () => {
  const blocos = agruparBlocos([
    slotKey('quadra-1', 2, 19),
    slotKey('quadra-1', 2, 20),
  ])

  assert.equal(blocos.length, 1)
  assert.deepEqual(
    { dia: blocos[0].diaSemana, from: blocos[0].from, to: blocos[0].to },
    { dia: 2, from: 19, to: 21 }
  )
})

test('buraco entre as horas quebra em dois blocos', () => {
  const blocos = agruparBlocos([
    slotKey('quadra-1', 2, 9),
    slotKey('quadra-1', 2, 10),
    slotKey('quadra-1', 2, 19),
  ])

  assert.equal(blocos.length, 2)
  assert.deepEqual(blocos.map((b) => [b.from, b.to]), [
    [9, 11],
    [19, 20],
  ])
})

test('a mesma hora em espaços diferentes não se funde', () => {
  const blocos = agruparBlocos([
    slotKey('quadra-1', 6, 9),
    slotKey('quadra-2', 6, 9),
  ])

  assert.equal(blocos.length, 2)
  assert.deepEqual(new Set(blocos.map((b) => b.courtId)), new Set(['quadra-1', 'quadra-2']))
})

// ── Calendário ────────────────────────────────────────────────────────────

test('conta as ocorrências reais do dia da semana, não um número fixo', () => {
  // Setembro de 2026: terças em 1, 8, 15, 22 e 29 — cinco, não quatro.
  const setembro = ocorrencias(2, new Date(2026, 8, 1), new Date(2026, 8, 30))
  assert.equal(setembro.length, 5)

  // A partir do dia 9 sobram três.
  const desdeNove = ocorrencias(2, new Date(2026, 8, 9), new Date(2026, 8, 30))
  assert.equal(desdeNove.length, 3)
})

// ── Pró-rata ──────────────────────────────────────────────────────────────

test('o pró-rata pondera por duração, não por número de sessões', () => {
  // Terça de 1h e sábado de 2h. Perder sábados pesa o dobro de perder terças.
  const blocos = agruparBlocos([
    slotKey('quadra-1', 2, 19),
    slotKey('quadra-1', 6, 9),
    slotKey('quadra-1', 6, 10),
  ])

  const mesInteiro = fracaoPrimeiroMes(blocos, new Date(2026, 8, 1))
  assert.equal(mesInteiro, 1, 'começando no dia 1 cobra o mês cheio')

  const parcial = fracaoPrimeiroMes(blocos, new Date(2026, 8, 9))
  assert.ok(parcial > 0 && parcial < 1, `esperava fração parcial, veio ${parcial}`)

  // Numerador: o que ainda cabe em setembro a partir de 09/09 —
  //   3 terças (3h) + 3 sábados (6h) = 9h.
  // Denominador: o MÊS DE REFERÊNCIA, que é outubro (o primeiro mês em que o
  // plano roda inteiro) — 4 terças (4h) + 5 sábados (10h) = 14h. É o mesmo mês
  // que sugeriu a mensalidade; dividir pelo mês de início cobraria a mais.
  assert.equal(Math.round(parcial * 1000) / 1000, Math.round((9 / 14) * 1000) / 1000)
})

test('sem blocos a fração é zero em vez de dividir por zero', () => {
  assert.equal(fracaoPrimeiroMes([], new Date(2026, 8, 9)), 0)
})

// ── Subtotal ──────────────────────────────────────────────────────────────

test('o subtotal multiplica cada bloco pelas ocorrências do seu dia', () => {
  const blocos = agruparBlocos([slotKey('quadra-1', 2, 19), slotKey('quadra-1', 2, 20)])
  const resumo = resumirPlano(blocos, [170], new Date(2026, 8, 9))

  assert.equal(resumo.horasSemana, 2)
  assert.equal(resumo.valorSemana, 170)
  // Outubro/2026 tem 4 terças.
  assert.equal(resumo.ocorrenciasMesCheio, 4)
  assert.equal(resumo.valorMesCheio, 680)
})

// ── Disponibilidade no horizonte de 3 meses ───────────────────────────────

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

const agora = new Date(2026, 8, 9, 8, 0, 0)

test('horário sem reserva nenhuma fica livre', () => {
  const info = avaliarSlot({
    court: quadraAberta,
    diaSemana: 2,
    hora: 19,
    inicioVigencia: new Date(2026, 8, 9),
    fimHorizonte: new Date(2026, 11, 0),
    bookingsPorCourt: new Map(),
    agora,
  })

  assert.equal(info.status, 'free')
})

test('conflito numa ocorrência futura bloqueia o horário, não só a semana atual', () => {
  // Livre na terça que vem, ocupado na terça de 6 de outubro.
  const bookings = new Map([
    [
      'quadra-1',
      [
        {
          court_id: 'quadra-1',
          start_time: new Date(2026, 9, 6, 19, 0).toISOString(),
          end_time: new Date(2026, 9, 6, 20, 0).toISOString(),
          status: 'confirmed',
          athlete_name: 'Marina C.',
        },
      ],
    ],
  ])

  const info = avaliarSlot({
    court: quadraAberta,
    diaSemana: 2,
    hora: 19,
    inicioVigencia: new Date(2026, 8, 9),
    fimHorizonte: new Date(2026, 11, 0),
    bookingsPorCourt: bookings,
    agora,
  })

  assert.equal(info.status, 'conflict-future')
  assert.equal(info.conflictDate?.getDate(), 6)
})

test('reserva cancelada não bloqueia o horário', () => {
  const bookings = new Map([
    [
      'quadra-1',
      [
        {
          court_id: 'quadra-1',
          start_time: new Date(2026, 8, 15, 19, 0).toISOString(),
          end_time: new Date(2026, 8, 15, 20, 0).toISOString(),
          status: 'cancelled',
          athlete_name: 'Cancelada',
        },
      ],
    ],
  ])

  const info = avaliarSlot({
    court: quadraAberta,
    diaSemana: 2,
    hora: 19,
    inicioVigencia: new Date(2026, 8, 9),
    fimHorizonte: new Date(2026, 11, 0),
    bookingsPorCourt: bookings,
    agora,
  })

  assert.equal(info.status, 'free')
})

test('fora do funcionamento do espaço não é selecionável', () => {
  const info = avaliarSlot({
    court: {
      ...quadraAberta,
      day_config: quadraAberta.day_config.map((d) =>
        d.day === 'Terça-feira' ? { ...d, enabled: false } : d
      ),
    },
    diaSemana: 2,
    hora: 19,
    inicioVigencia: new Date(2026, 8, 9),
    fimHorizonte: new Date(2026, 11, 0),
    bookingsPorCourt: new Map(),
    agora,
  })

  assert.equal(info.status, 'closed')
})

// ── Contrato com o banco ──────────────────────────────────────────────────

test('a criação por blocos vai pelo RPC atômico, sem escrita direta em tabela', () => {
  const actions = read('../src/modules/bookings/actions/mensalistaActions.ts')

  assert.match(actions, /create_monthly_plan_blocks_atomic/)
  assert.match(actions, /await assertArenaBackofficeAccess\(arenaId\)/)
  // Cada espaço dos blocos é validado contra a arena antes de chamar o RPC.
  assert.match(actions, /for \(const courtId of courtIds\) \{\s*await assertCourtAccess\(/)
  // Nada de insert direto em planos_mensalista_blocos pela camada web.
  assert.doesNotMatch(actions, /from\('planos_mensalista_blocos'\)/)
})

test('a tela de mensalistas carrega os blocos junto do plano', () => {
  const actions = read('../src/modules/mensalistas/actions/mensalistaActions.ts')

  // Sem o embed, o detalhe mostraria só o primeiro bloco — um plano de 6h em
  // três faixas apareceria como uma faixa de 2h com o valor cheio.
  assert.match(actions, /blocos:planos_mensalista_blocos\(/)
  assert.match(actions, /blocos:planos_mensalista_blocos\([^)]*dia_semana/)
  assert.match(actions, /blocos:planos_mensalista_blocos\([^)]*horario_fim/)
})

test('o detalhe resume as faixas em vez de exibir só a primeira', () => {
  const detail = read('../src/modules/mensalistas/components/MensalistaDetailClient.tsx')

  // Cabeçalho agregado quando há mais de uma faixa...
  assert.match(detail, /blocos\.length > 1/)
  assert.match(detail, /horários · \{horasSemana\}h por semana/)
  // ...e a lista completa das faixas dentro do card aberto.
  assert.match(detail, /Horários da recorrência/)
  // O aviso de encerramento não pode anunciar um horário só quando há vários.
  assert.match(detail, /Horários liberados para revenda/)
  // Plano legado (uma faixa) continua no formato antigo.
  assert.match(detail, /Horário liberado para revenda: \{DIAS\[p\.dia_semana\]\} \{horario\}/)
})

test('a grade só deixa marcar horário efetivamente livre', () => {
  const lib = read('../src/modules/bookings/lib/mensalista-blocos.ts')
  const picker = read('../src/modules/bookings/components/MensalistaBlocosPicker.tsx')

  // "bloqueia o bloco": só 'free' é selecionável — conflito futuro não conta.
  assert.match(lib, /export function podeSelecionar[\s\S]{0,120}status === 'free'/)
  assert.match(picker, /disabled=\{disabled \|\| !selecionavel\}/)
})

// ── Pró-rata da 1ª mensalidade × valor do mês cheio ───────────────────────
// O mensal e o pró-rata precisam implicar o MESMO preço por sessão. Quando o
// mensal é calculado num mês de referência (5 quintas) e o pró-rata é dividido
// por outro (setembro, 4 quintas), a 1ª mensalidade sai 25% acima do combinado.

const QUINTA_20H = {
  courtId: 'q3',
  courtName: 'Quadra 03',
  diaSemana: 4,
  from: 20,
  to: 21,
  hours: [20],
}

/** Preço por sessão que o valor mensal sugerido representa. */
const taxaMensal = (resumo) => resumo.valorMesCheio / resumo.ocorrenciasMesCheio

/** Preço por sessão que o pró-rata cobra de fato. */
const taxaProRata = (resumo, fracao) =>
  (resumo.valorMesCheio * fracao) / resumo.ocorrenciasPrimeiroMes

test('o pró-rata cobra o mesmo preço por sessão que o valor mensal', () => {
  // Quinta 20h–21h a R$ 100/ocorrência, plano criado em sexta 11/09/2026.
  const inicio = new Date(2026, 8, 11)
  const resumo = resumirPlano([QUINTA_20H], [100], inicio)
  const fracao = fracaoPrimeiroMes([QUINTA_20H], inicio)

  assert.equal(
    Math.round(taxaProRata(resumo, fracao) * 100) / 100,
    Math.round(taxaMensal(resumo) * 100) / 100,
    'o gestor combinou um preço por sessão; o pró-rata não pode cobrar outro'
  )
})

test('caso do gestor: restam 2 quintas em setembro/2026, pró-rata = 2 sessões', () => {
  const inicio = new Date(2026, 8, 11) // sexta
  const resumo = resumirPlano([QUINTA_20H], [100], inicio)
  const fracao = fracaoPrimeiroMes([QUINTA_20H], inicio)

  // setembro/2026 tem quintas em 3, 10, 17 e 24 — restam 17 e 24
  assert.equal(resumo.ocorrenciasPrimeiroMes, 2)
  assert.equal(resumo.valorMesCheio, 500, 'outubro tem 5 quintas: 5 × R$ 100')
  assert.equal(
    Math.round(resumo.valorMesCheio * fracao * 100) / 100,
    200,
    '2 sessões restantes a R$ 100 = R$ 200'
  )
})

test('plano que começa no dia 1º não tem pró-rata, e o mensal é o do próprio mês', () => {
  const inicio = new Date(2026, 8, 1) // terça, 01/09/2026
  const resumo = resumirPlano([QUINTA_20H], [100], inicio)
  const fracao = fracaoPrimeiroMes([QUINTA_20H], inicio)

  assert.equal(fracao, 1, 'o mês inteiro está disponível — nada a proporcionalizar')
  assert.equal(resumo.ocorrenciasMesCheio, 4, 'setembro/2026 tem 4 quintas')
  assert.equal(resumo.valorMesCheio, 400, 'e o mensal sugerido acompanha: 4 × R$ 100')
})

test('a referência do mês cheio é o primeiro mês em que o plano roda inteiro', () => {
  // começando dia 1º, o próprio mês já é cheio
  assert.equal(resumirPlano([QUINTA_20H], [100], new Date(2026, 9, 1)).ocorrenciasMesCheio, 5,
    'outubro/2026 tem 5 quintas')
  // começando no meio, a referência é o mês seguinte
  assert.equal(resumirPlano([QUINTA_20H], [100], new Date(2026, 9, 15)).ocorrenciasMesCheio, 4,
    'novembro/2026 tem 4 quintas')
})

test('com blocos de durações diferentes, a invariante é por minuto', () => {
  // Terça 1h a R$ 50 e sábado 2h a R$ 100 — mesmo R$ 50/hora nos dois.
  const terca = { courtId: 'q1', courtName: 'Q1', diaSemana: 2, from: 19, to: 20, hours: [19] }
  const sabado = { courtId: 'q1', courtName: 'Q1', diaSemana: 6, from: 9, to: 11, hours: [9, 10] }
  const inicio = new Date(2026, 8, 11)

  const resumo = resumirPlano([terca, sabado], [50, 100], inicio)
  const fracao = fracaoPrimeiroMes([terca, sabado], inicio)
  assert.ok(fracao > 0 && fracao < 1)

  // Preço por sessão NÃO serve de invariante aqui: outubro tem 4 terças e 5
  // sábados, enquanto o resto de setembro tem 3 e 3 — a mistura é outra, então a
  // média por sessão muda de propósito. O que tem que bater é o preço por hora.
  const horasReferencia = 4 * 1 + 5 * 2
  const horasRestantes = 3 * 1 + 3 * 2
  assert.equal(
    Math.round(((resumo.valorMesCheio * fracao) / horasRestantes) * 100) / 100,
    Math.round((resumo.valorMesCheio / horasReferencia) * 100) / 100,
    'o preço por hora do pró-rata é o mesmo do mensal'
  )

  // E, com preço por hora uniforme, o pró-rata bate exatamente com a soma das
  // sessões que sobraram no mês.
  assert.equal(
    Math.round(resumo.valorMesCheio * fracao * 100) / 100,
    resumo.valorPrimeiroMes,
    'pró-rata = valor real das sessões restantes'
  )
})

// ── O banco cobra o mesmo que a tela mostrou ──────────────────────────────

test('o pró-rata do banco usa o mesmo mês de referência da tela', { skip: !hasDbRepo }, () => {
  const sql = readMigration('20260909120030_mensalista_blocos_prorata.sql')

  // denominador = primeiro mês em que o plano roda inteiro (agora no helper)
  assert.match(
    readMigration('20260909120000_mensalista_blocos_schema.sql'),
    /v_reference_month := CASE[\s\S]{0,320}date_trunc\('month', v_plan\.data_inicio\) \+ interval '1 month'/
  )
  // A fórmula mora em `private.mensalista_valor_competencia` (schema de blocos),
  // porque o reajuste precisa aplicar exatamente a mesma regra.
  assert.match(sql, /private\.mensalista_valor_competencia\(\s*\n\s*v_plan\.id, v_competencia, v_plan\.valor_mensal\s*\n\s*\)/)

  const helper = readMigration('20260909120000_mensalista_blocos_schema.sql')
  assert.match(
    helper,
    /v_full_minutes := private\.mensalista_month_minutes\(\s*\n\s*p_plan_id, v_reference_month, v_reference_month\s*\n\s*\)/,
    'o mês cheio tem que ser medido no mês de referência'
  )
  assert.match(
    helper,
    /v_month_minutes := private\.mensalista_month_minutes\(\s*\n\s*p_plan_id, date_trunc\('month', p_competencia\)::date, v_plan\.data_inicio\s*\n\s*\)/
  )
  // e o caminho legado (sessoes_por_mes) segue intocado
  assert.match(sql, /round\(v_plan\.valor_mensal \/ v_plan\.sessoes_por_mes, 2\) \* v_first_sessions/)
})

// ── Modelo de cobrança: preço da hora fixo, fatura acompanha o calendário ──

test('a fatura de cada mês acompanha quantas reservas o mês tem', () => {
  const inicio = new Date(2026, 8, 11)
  const resumo = resumirPlano([QUINTA_20H], [100], inicio)

  assert.deepEqual(
    resumo.variacaoMensal,
    [
      { ocorrencias: 4, valor: 400 },
      { ocorrencias: 5, valor: 500 },
    ],
    'quinta cai em meses de 4 e de 5 — a mensalidade tem que refletir isso'
  )
})

test('somando as competências, cada sessão custa o preço de tabela', () => {
  // Uma janela de 12 meses tem 52 OU 53 quintas — não dá para fixar o total em
  // R$ 5.200. O que vale sempre é: total ÷ sessões = preço da hora.
  const inicio = new Date(2026, 9, 1) // outubro, que já é o mês de referência
  const resumo = resumirPlano([QUINTA_20H], [100], inicio)

  let total = 0
  let sessoes = 0
  for (let i = 0; i < 12; i++) {
    const mes = new Date(2026, 9 + i, 1)
    const fim = new Date(mes.getFullYear(), mes.getMonth() + 1, 0)
    const n = ocorrencias(4, mes, fim).length
    sessoes += n
    total += resumo.valorMesCheio * (n / resumo.ocorrenciasMesCheio)
  }

  assert.ok(sessoes === 52 || sessoes === 53, `janela de 12 meses: ${sessoes} quintas`)
  assert.equal(Math.round((total / sessoes) * 100) / 100, 100, 'R$ 100 por sessão, sempre')
  assert.equal(Math.round(total * 100) / 100, sessoes * 100)
})

test('plano sem variação de calendário não polui a tela', () => {
  // Sete blocos, um por dia da semana: todo mês tem 28..31 ocorrências, então
  // há variação; já um plano de um dia só em fevereiro não-bissexto seria fixo.
  // O que importa aqui é o contrato: a lista traz os valores DISTINTOS.
  const resumo = resumirPlano([QUINTA_20H], [100], new Date(2026, 9, 1))
  const valores = resumo.variacaoMensal.map((v) => v.valor)
  assert.equal(new Set(valores).size, valores.length, 'sem valores repetidos')
})

test('o banco valora TODA competência, não só a primeira', { skip: !hasDbRepo }, () => {
  const sql = readMigration('20260909120030_mensalista_blocos_prorata.sql')
  const corpo = sql.slice(sql.indexOf('v_valor_total := round(v_plan.valor_mensal, 2);'))

  const blocos = corpo.indexOf('IF v_plan.recorrencia_por_blocos THEN')
  const proporcional = corpo.indexOf('private.mensalista_valor_competencia(')
  const guardaEstreia = corpo.indexOf("date_trunc('month', v_plan.data_inicio)::date = v_competencia")

  assert.ok(blocos !== -1 && proporcional !== -1 && guardaEstreia !== -1)
  assert.ok(
    blocos < proporcional,
    'o cálculo proporcional pertence ao ramo de blocos'
  )
  assert.ok(
    proporcional < guardaEstreia,
    'a guarda "só na competência de estreia" ficou DEPOIS do ramo de blocos — ' +
      'se voltar para antes, os meses seguintes param de ser proporcionais'
  )
  assert.match(corpo.slice(guardaEstreia), /sessoes_por_mes/, 'o legado segue por sessões')
  assert.ok(
    corpo.includes("ELSIF date_trunc('month', v_plan.data_inicio)::date = v_competencia"),
    'os dois ramos são exclusivos (ELSIF), não aninhados'
  )
})

test('o preço de uma reserva é sempre o mesmo, em qualquer mês', { skip: !hasDbRepo }, () => {
  const sql = readMigration('20260909120010_mensalista_blocos_bookings.sql')

  // denominador do rateio = mês de referência (constante do plano), não o mês corrente
  assert.match(
    sql,
    /v_total_minutes := private\.mensalista_month_minutes\(\s*\n\s*p_plan_id, v_reference_month, v_reference_month\s*\n\s*\)/
  )
  assert.match(sql, /v_reference_month := CASE/)
  assert.match(sql, /v_plan\.valor_mensal \* \(v_block_minutes \/ v_total_minutes\)/)
})
