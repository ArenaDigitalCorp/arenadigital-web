import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  arredondar,
  editavel,
  impacto,
  parseValor,
  precisaAnalise,
  selecionadaPorPadrao,
  selos,
  semAlteracao,
  validarNovoValor,
  valorInicial,
  variacaoJogos,
} from '../src/modules/mensalistas/reajuste-mes.ts'
import { reajusteMesLoteSchema } from '../src/modules/mensalistas/schemas/mensalista.schema.ts'

// Quarta de R$ 400 por 4 jogos num mês de 5 quartas (ex.: dezembro/2026).
const linha = (over = {}) => ({
  planoId: 'p1',
  athleteId: 'a1',
  atleta: 'Caco Barcelos',
  recorrencia: 'Quadra 04 · Qua · 20:00 às 21:00',
  porBlocos: false,
  valorMensal: 400,
  sessoesPorMes: 4,
  valorPorJogo: 100,
  jogosAnterior: 4,
  valorAnterior: 400,
  jogos: 5,
  jogosEmPausa: 0,
  jogosLiquidos: 5,
  estreia: false,
  encerra: false,
  mensalidadeId: 'm1',
  mensalidadeStatus: 'aberto',
  rateio: false,
  valorAtual: 400,
  valorPago: 0,
  valorSugerido: 500,
  ...over,
})

// ── O que entra para análise e o que vem marcado ──────────────────────────

test('mês com um jogo a mais precisa de análise e vem marcado', () => {
  const l = linha()
  assert.equal(precisaAnalise(l), true)
  assert.equal(selecionadaPorPadrao(l), true)
  assert.equal(variacaoJogos(l), 'sobe')
})

test('valor que já bate com os jogos do mês não precisa de análise', () => {
  const l = linha({ jogosAnterior: 5, jogosLiquidos: 4, jogos: 4, valorSugerido: 400 })
  assert.equal(precisaAnalise(l), false)
  assert.equal(variacaoJogos(l), 'desce')
})

test('rateio, parcial, pausa, estreia e encerramento entram com selo e desmarcados', () => {
  const casos = [
    [{ rateio: true }, 'rateio'],
    [{ valorPago: 150, mensalidadeStatus: 'parcial' }, 'parcial'],
    [{ jogosEmPausa: 2, jogosLiquidos: 3, valorSugerido: 300 }, 'pausa'],
    [{ estreia: true }, 'estreia'],
    [{ encerra: true, jogosLiquidos: 0, valorSugerido: 0 }, 'encerra'],
  ]
  for (const [over, selo] of casos) {
    const l = linha(over)
    assert.ok(selos(l).includes(selo), selo)
    assert.equal(precisaAnalise(l), true, selo)
    assert.equal(selecionadaPorPadrao(l), false, selo)
  }
})

test('quitada, cancelada e plano por blocos não se editam', () => {
  assert.equal(editavel(linha({ mensalidadeStatus: 'quitado', valorPago: 400 })), false)
  assert.equal(editavel(linha({ mensalidadeStatus: 'cancelado' })), false)
  const blocos = linha({ porBlocos: true, valorSugerido: null })
  assert.equal(editavel(blocos), false)
  assert.equal(precisaAnalise(blocos), false)
  assert.deepEqual(selos(linha({ mensalidadeStatus: 'quitado', valorPago: 400 })), ['quitada'])
})

// ── Valor ──────────────────────────────────────────────────────────────────

test('arredondamento das sugestões: centavos, R$ 1 e R$ 5', () => {
  assert.equal(arredondar(533.335, 'centavos'), 533.34)
  assert.equal(arredondar(533.33, 'real'), 533)
  assert.equal(arredondar(533.33, 'cinco'), 535)
  assert.equal(valorInicial(linha({ valorSugerido: 533.33 }), 'cinco'), 535)
  // Sem sugestão (sem jogos de contrato), parte do valor atual.
  assert.equal(valorInicial(linha({ valorSugerido: null }), 'centavos'), 400)
})

test('com pagamento parcial, o novo valor precisa ficar acima do já pago', () => {
  const parcial = linha({ valorPago: 150, mensalidadeStatus: 'parcial' })
  assert.equal(validarNovoValor(parcial, 150), 'abaixo_do_pago')
  assert.equal(validarNovoValor(parcial, 120), 'abaixo_do_pago')
  assert.equal(validarNovoValor(parcial, 500), null)
  assert.equal(validarNovoValor(linha(), -1), 'invalido')
  assert.equal(validarNovoValor(linha(), Number.NaN), 'invalido')
  assert.equal(semAlteracao(linha(), 400.004), true)
})

test('campo aceita formato brasileiro', () => {
  assert.equal(parseValor('1.234,50'), 1234.5)
  assert.equal(parseValor('R$ 500,00'), 500)
  assert.equal(parseValor('625.5'), 625.5)
  assert.ok(Number.isNaN(parseValor('')))
})

test('impacto soma as diferenças do mês (sobe e desce)', () => {
  assert.equal(
    impacto([
      { valorAtual: 400, novoValor: 500 },
      { valorAtual: 625, novoValor: 500 },
      { valorAtual: 320, novoValor: 400 },
    ]),
    55
  )
})

// ── Contrato com o servidor ────────────────────────────────────────────────

const lote = {
  arenaId: '11111111-1111-4111-8111-111111111111',
  operationId: '22222222-2222-4222-8222-222222222222',
  competencia: '2026-12',
  observacao: null,
  itens: [{ planoId: '33333333-3333-4333-8333-333333333333', novoValor: 500, valorEsperado: 400 }],
}

test('lote exige competência YYYY-MM, valor esperado e de 1 a 500 itens', () => {
  assert.equal(reajusteMesLoteSchema.safeParse(lote).success, true)
  assert.equal(reajusteMesLoteSchema.safeParse({ ...lote, competencia: '2026-12-01' }).success, false)
  assert.equal(reajusteMesLoteSchema.safeParse({ ...lote, itens: [] }).success, false)
  assert.equal(
    reajusteMesLoteSchema.safeParse({ ...lote, itens: [{ ...lote.itens[0], valorEsperado: undefined }] }).success,
    false
  )
  const muitos = Array.from({ length: 501 }, () => lote.itens[0])
  assert.equal(reajusteMesLoteSchema.safeParse({ ...lote, itens: muitos }).success, false)
})

test('actions materializam o mês antes da prévia e mandam o valor esperado ao lote', async () => {
  const actions = await readFile(
    new URL('../src/modules/mensalistas/actions/mensalistaActions.ts', import.meta.url),
    'utf8'
  )
  const previa = actions.slice(actions.indexOf('export async function getReajusteMesPreviewAction'))
  assert.ok(
    previa.indexOf("'generate_mensalista_mensalidades_atomic'") <
      previa.indexOf("'mensalista_reajuste_mes_preview'"),
    'gera a competência antes da prévia'
  )
  assert.match(actions, /'reajustar_mensalidades_mes_lote_atomic'/)
  assert.match(actions, /valor_esperado: item\.valorEsperado/)
  assert.match(actions, /p_competencia: `\$\{parsed\.competencia\}-01`/)
})
