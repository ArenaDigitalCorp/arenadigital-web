import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  fracaoPrimeiroMes,
  mesReferencia,
  ocorrencias,
  resumirPlano,
} from '../src/modules/bookings/lib/mensalista-blocos.ts'

/**
 * O fluxo do mensalista tem duas metades que precisam concordar: a tela calcula
 * o que o gestor vê antes de criar o plano, e o banco calcula o que ele vai
 * cobrar. O teste ponta a ponta do servidor é
 * `arenadigital-db/supabase/tests/20260911140000_mensalista_fluxo_completo_test.sql`.
 * Aqui travamos a metade do cliente com o MESMO cenário, para as duas não
 * saírem do ar uma da outra.
 */

const DB_ROOT = fileURLToPath(new URL('../../../arenadigital-db/', import.meta.url))
const hasDbRepo = existsSync(DB_ROOT)
const E2E = `${DB_ROOT}supabase/tests/20260911140000_mensalista_fluxo_completo_test.sql`

const PRECO_HORA = 100
const fimDe = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0)

/** Mesmo contexto do pgTAP: mês depois do próximo, início no dia 11, dia da semana o do dia 17. */
function cenario(hoje = new Date()) {
  const mesInicio = new Date(hoje.getFullYear(), hoje.getMonth() + 2, 1)
  const dataInicio = new Date(mesInicio.getFullYear(), mesInicio.getMonth(), 11)
  const dow = new Date(mesInicio.getFullYear(), mesInicio.getMonth(), 17).getDay()
  const bloco = { courtId: 'q1', courtName: 'Quadra', diaSemana: dow, from: 20, to: 21, hours: [20] }
  const ref = mesReferencia(dataInicio)

  const ocorrenciasRef = ocorrencias(dow, ref, fimDe(ref)).length
  const restantes = ocorrencias(dow, dataInicio, fimDe(dataInicio)).length
  const valorMensal = PRECO_HORA * ocorrenciasRef
  const resumo = resumirPlano([bloco], [PRECO_HORA], dataInicio)
  const primeira =
    Math.round(valorMensal * fracaoPrimeiroMes([bloco], dataInicio) * 100) / 100

  return { bloco, dataInicio, dow, ref, ocorrenciasRef, restantes, valorMensal, resumo, primeira }
}

test('o cenário sempre tem um mês de estreia parcial de verdade', () => {
  const c = cenario()
  assert.ok(c.restantes >= 2, `restaram ${c.restantes} ocorrências`)
  assert.ok(
    c.restantes < c.ocorrenciasRef || c.restantes < 4,
    'o mês de estreia tem que ser parcial para o pró-rata ser exercitado'
  )
})

test('a tela sugere preço da hora × ocorrências do mês de referência', () => {
  const c = cenario()
  assert.equal(c.resumo.ocorrenciasMesCheio, c.ocorrenciasRef)
  assert.equal(c.resumo.valorMesCheio, c.valorMensal)
})

test('a 1ª mensalidade é preço da hora × sessões que restam', () => {
  const c = cenario()
  assert.equal(c.resumo.ocorrenciasPrimeiroMes, c.restantes)
  assert.equal(c.primeira, PRECO_HORA * c.restantes)
})

test('o preço por sessão é o mesmo na estreia e no mês cheio', () => {
  const c = cenario()
  assert.equal(
    Math.round((c.primeira / c.resumo.ocorrenciasPrimeiroMes) * 100) / 100,
    Math.round((c.resumo.valorMesCheio / c.resumo.ocorrenciasMesCheio) * 100) / 100
  )
})

test('o crédito de um jogo cancelado é o preço de uma sessão', () => {
  const c = cenario()
  // É o que `quoteSessaoMensalistaAction` devolve: resolve_court_price de 1h na
  // tabela do plano. Aqui conferimos que bate com a unidade do plano.
  assert.equal(c.resumo.valorMesCheio / c.resumo.ocorrenciasMesCheio, PRECO_HORA)
})

test('o cálculo vale em qualquer mês do ano, inclusive fevereiro', () => {
  // Fevereiro não-bissexto tem 28 dias: todo dia da semana cai 4 vezes, e nenhum
  // mês de referência tem 5. O cálculo não pode assumir 4-ou-5.
  for (let mes = 0; mes < 12; mes++) {
    const c = cenario(new Date(2027, mes, 5))
    assert.equal(
      c.primeira,
      PRECO_HORA * c.restantes,
      `mês ${mes + 1}: 1ª mensalidade saiu ${c.primeira} para ${c.restantes} sessões`
    )
    assert.ok(c.resumo.valorMesCheio > 0)
  }
})

// ── O teste ponta a ponta do servidor cobre cada passo do fluxo ────────────

test('o pgTAP cobre a jornada inteira', { skip: !hasDbRepo }, () => {
  const sql = readFileSync(E2E, 'utf8')

  const passos = [
    ['tabela de preço escolhida', /a hora cotada pela tabela Mensalista/],
    ['tabelas não se misturam', /as tabelas não se misturam/],
    ['criação do plano', /create_monthly_plan_blocks_atomic/],
    ['reservas do mês', /o mês de estreia recebe exatamente as ocorrências/],
    ['preço de cada reserva', /cada reserva vale o preço da hora da tabela/],
    ['1ª mensalidade proporcional', /a 1a mensalidade é o preço da hora/],
    ['mês cheio', /o mês de referência cobra o valor mensal cheio/],
    ['mesmo preço por sessão', /implicam o MESMO preço por sessão/],
    ['cobrança do titular', /a cobrança do titular acompanha a mensalidade/],
    ['cancelar o jogo', /a reserva do dia é cancelada/],
    ['crédito vinculado', /com exatamente um crédito vinculado ao jogo/],
    ['crédito para o titular', /para o titular do plano/],
    ['saldo do mensalista', /o saldo do mensalista reflete o crédito/],
    ['mensalidade intacta', /a mensalidade do mês NÃO muda/],
    ['plano segue ativo', /a recorrência continua ativa/],
    ['idempotência', /cancelar de novo devolve o estado/],
    ['avulso recusado', /reserva avulsa não é cancelada por este caminho/],
    ['ajuste pontual', /o ajuste pontual grava o valor exato naquele mês/],
    ['plano intocado no pontual', /o valor do plano NÃO é alterado/],
    ['vigência não alcança o mês anterior', /NÃO alcança o mês anterior/],
    ['histórico do reajuste', /a vigência registrada é a competência que o gestor estava vendo/],
  ]

  for (const [passo, re] of passos) {
    assert.match(sql, re, `o teste ponta a ponta perdeu a cobertura de: ${passo}`)
  }
})

test('o pgTAP usa datas relativas, não literais que expiram', { skip: !hasDbRepo }, () => {
  const sql = readFileSync(E2E, 'utf8')
  assert.match(sql, /date_trunc\('month', CURRENT_DATE::timestamp\) \+ interval '2 months'/)
  assert.doesNotMatch(sql, /'20\d\d-\d\d-\d\d'::date/, 'data literal vira teste quebrado no futuro')
  assert.match(sql, /extensions\.plan\(31\)/)
})
