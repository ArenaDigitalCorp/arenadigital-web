import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { register } from 'node:module'
import test from 'node:test'

// mensalista-credit-rows.ts importa credito-recorrencia.ts via alias `@/`
// (resolvido pelo bundler). Aqui o alias é mapeado para `src/` só neste teste.
const srcRoot = new URL('../src/', import.meta.url).href
register(
  'data:text/javascript,' +
    encodeURIComponent(`
      export async function resolve(specifier, context, next) {
        if (specifier.startsWith('@/')) {
          return next(${JSON.stringify(srcRoot)} + specifier.slice(2) + '.ts', context)
        }
        return next(specifier, context)
      }
    `)
)

const { CREDITO_TIPO_LABEL, formatRecorrenciaLabel } = await import(
  '../src/modules/mensalistas/credito-recorrencia.ts'
)
const { buildMensalistaCreditRows } = await import('../src/modules/reports/mensalista-credit-rows.ts')
const { buildMensalistaCreditSheetData } = await import('../src/modules/reports/payment-status-export.ts')
const { lancarCreditoSchema } = await import('../src/modules/mensalistas/schemas/mensalista.schema.ts')

const quarta = {
  dia_semana: 3,
  horario_inicio: '20:00:00',
  horario_fim: '21:00:00',
  court: { name: 'Quadra 04' },
  blocos: [],
}

// ── Rótulo da recorrência ──────────────────────────────────────────────────

test('recorrência de uma faixa: quadra · dia · horário, como no cabeçalho da tela', () => {
  assert.equal(formatRecorrenciaLabel(quarta), 'Quadra 04 · Qua · 20:00 às 21:00')
})

test('um único bloco vale o mesmo que a recorrência simples', () => {
  const comUmBloco = {
    ...quarta,
    blocos: [{ dia_semana: 3, horario_inicio: '20:00', horario_fim: '21:00', court: { name: 'Quadra 04' } }],
  }
  assert.equal(formatRecorrenciaLabel(comUmBloco), 'Quadra 04 · Qua · 20:00 às 21:00')
})

test('vários blocos na mesma quadra listam todas as faixas, em ordem de dia', () => {
  const professor = {
    ...quarta,
    blocos: [
      { dia_semana: 5, horario_inicio: '20:00', horario_fim: '21:00', court: { name: 'Quadra 04' } },
      { dia_semana: 3, horario_inicio: '20:00', horario_fim: '21:00', court: { name: 'Quadra 04' } },
    ],
  }
  assert.equal(
    formatRecorrenciaLabel(professor),
    'Quadra 04 · Qua 20:00 às 21:00 / Sex 20:00 às 21:00'
  )
})

test('vários blocos em quadras diferentes mostram a quadra de cada faixa', () => {
  const professor = {
    ...quarta,
    blocos: [
      { dia_semana: 3, horario_inicio: '20:00', horario_fim: '21:00', court: { name: 'Quadra 04' } },
      { dia_semana: 5, horario_inicio: '08:00', horario_fim: '09:00', court: { name: 'Quadra 02' } },
    ],
  }
  assert.equal(
    formatRecorrenciaLabel(professor),
    'Qua 20:00 às 21:00 (Quadra 04) / Sex 08:00 às 09:00 (Quadra 02)'
  )
})

test('sem quadra resolvida, o rótulo fica só com dia e horário', () => {
  assert.equal(formatRecorrenciaLabel({ ...quarta, court: null }), 'Qua · 20:00 às 21:00')
})

// ── Linhas do relatório ────────────────────────────────────────────────────

const movimento = (over) => ({
  id: 'c1',
  tipo: 'lancamento',
  valor: '100.00',
  descricao: null,
  created_at: '2026-10-05T13:00:00+00:00',
  atleta: { id: 'a1', nome_perfil: 'Caco Barcelos' },
  plano: null,
  ...over,
})

test('crédito vinculado sai com o rótulo da recorrência; sem vínculo sai null', () => {
  const [vinculado, solto] = buildMensalistaCreditRows([
    movimento({ id: 'c1', plano: quarta, descricao: 'Crédito da quarta' }),
    movimento({ id: 'c2', created_at: '2026-10-06T13:00:00+00:00' }),
  ])

  assert.deepEqual(vinculado, {
    id: 'mensalista-credito-c1',
    data: '2026-10-05T13:00:00+00:00',
    atleta: 'Caco Barcelos',
    atletaId: 'a1',
    tipo: 'Lançamento',
    valor: 100,
    recorrencia: 'Quadra 04 · Qua · 20:00 às 21:00',
    descricao: 'Crédito da quarta',
  })
  assert.equal(solto.recorrencia, null)
})

test('movimentos saem em ordem cronológica, com o sinal do valor preservado', () => {
  const linhas = buildMensalistaCreditRows([
    movimento({ id: 'uso', tipo: 'uso', valor: '-40.00', created_at: '2026-10-20T12:00:00+00:00' }),
    movimento({ id: 'lanc', created_at: '2026-10-02T12:00:00+00:00' }),
  ])

  assert.deepEqual(
    linhas.map((l) => [l.tipo, l.valor]),
    [
      ['Lançamento', 100],
      [CREDITO_TIPO_LABEL.uso, -40],
    ]
  )
})

test('aba do Excel traz cabeçalho e "Geral" para o crédito sem recorrência', () => {
  const linhas = buildMensalistaCreditRows([
    movimento({ id: 'c1', plano: quarta }),
    movimento({ id: 'c2', created_at: '2026-10-06T13:00:00+00:00' }),
  ])
  const sheet = buildMensalistaCreditSheetData(linhas, (iso) => iso.slice(0, 10))

  assert.deepEqual(sheet, [
    ['Data', 'Atleta', 'Movimento', 'Crédito de', 'Descrição', 'Valor'],
    ['2026-10-05', 'Caco Barcelos', 'Lançamento', 'Quadra 04 · Qua · 20:00 às 21:00', '—', 100],
    ['2026-10-06', 'Caco Barcelos', 'Lançamento', 'Geral', '—', 100],
  ])
})

// ── Contrato do lançamento ─────────────────────────────────────────────────

const credito = {
  arenaId: '11111111-1111-4111-8111-111111111111',
  atletaId: '22222222-2222-4222-8222-222222222222',
  operationId: '33333333-3333-4333-8333-333333333333',
  valor: 100,
  descricao: null,
}

test('recorrência é opcional no lançamento de crédito', () => {
  const semVinculo = lancarCreditoSchema.parse(credito)
  assert.equal(semVinculo.planoId, null)

  const planoId = '44444444-4444-4444-8444-444444444444'
  assert.equal(lancarCreditoSchema.parse({ ...credito, planoId }).planoId, planoId)
  assert.equal(lancarCreditoSchema.safeParse({ ...credito, planoId: 'quarta' }).success, false)
})

test('a action repassa a recorrência ao RPC e o relatório mantém crédito fora dos lançamentos', async () => {
  const actions = await readFile(
    new URL('../src/modules/mensalistas/actions/mensalistaActions.ts', import.meta.url),
    'utf8'
  )
  assert.match(actions, /p_plano_id: parsed\.planoId \?\? undefined/)

  const report = await readFile(
    new URL('../src/modules/reports/actions/reportActions.ts', import.meta.url),
    'utf8'
  )
  // As linhas que somam nos cards/resumo não podem incluir os créditos.
  const rowsBlock = report.slice(
    report.indexOf('const rows: PaymentStatusRow[] = ['),
    report.indexOf('].sort(', report.indexOf('const rows: PaymentStatusRow[] = ['))
  )
  assert.match(rowsBlock, /\.\.\.mensalidadeRows/)
  assert.doesNotMatch(rowsBlock, /\bcreditos\b|mensalistaCredit/)
  assert.match(report, /creditos, creditoSaldo \}/)
})

// ── Subcontas do crédito ───────────────────────────────────────────────────

const { montarSubcontas, SUBCONTA_GERAL_LABEL } = await import(
  '../src/modules/mensalistas/credito-recorrencia.ts'
)
const { retirarCreditoSchema } = await import('../src/modules/mensalistas/schemas/mensalista.schema.ts')

const rotulos = { qua: 'Quadra 04 · Qua · 20:00 às 21:00', sex: 'Quadra 04 · Sex · 20:00 às 21:00' }

test('subcontas: a geral primeiro, depois as recorrências, só as que têm saldo', () => {
  const subcontas = montarSubcontas(
    [
      { plano_id: 'sex', saldo: '20.00' },
      { plano_id: 'qua', saldo: 100 },
      { plano_id: null, saldo: '50.00' },
      { plano_id: 'ter', saldo: 0 },
    ],
    (id) => rotulos[id]
  )

  assert.deepEqual(subcontas, [
    { planoId: null, label: SUBCONTA_GERAL_LABEL, saldo: 50 },
    { planoId: 'qua', label: 'Quadra 04 · Qua · 20:00 às 21:00', saldo: 100 },
    { planoId: 'sex', label: 'Quadra 04 · Sex · 20:00 às 21:00', saldo: 20 },
  ])
})

test('subconta geral zerada não aparece como opção de retirada', () => {
  assert.deepEqual(
    montarSubcontas([{ plano_id: null, saldo: 0 }, { plano_id: 'qua', saldo: 10 }], (id) => rotulos[id]).map(
      (s) => s.planoId
    ),
    ['qua']
  )
})

test('retirada escolhe a subconta; sem escolha, sai da geral', () => {
  const retirada = {
    arenaId: '11111111-1111-4111-8111-111111111111',
    atletaId: '22222222-2222-4222-8222-222222222222',
    operationId: '33333333-3333-4333-8333-333333333333',
    valor: 15,
    descricao: null,
  }
  assert.equal(retirarCreditoSchema.parse(retirada).planoId, null)
  const planoId = '44444444-4444-4444-8444-444444444444'
  assert.equal(retirarCreditoSchema.parse({ ...retirada, planoId }).planoId, planoId)
})

test('a action de retirada repassa a subconta ao RPC', async () => {
  const actions = await readFile(
    new URL('../src/modules/mensalistas/actions/mensalistaActions.ts', import.meta.url),
    'utf8'
  )
  const retiradaBlock = actions.slice(actions.indexOf("'withdraw_mensalista_credit_atomic'"))
  assert.match(retiradaBlock, /p_plano_id: parsed\.planoId \?\? undefined/)
  // Saldo por recorrência vem do banco, não de estimativa na tela.
  assert.match(actions, /from\('mensalista_credito_saldo_recorrencia'\)/)
})
