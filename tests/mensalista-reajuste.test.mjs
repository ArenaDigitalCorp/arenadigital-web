import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')

const modal = read('../src/modules/mensalistas/components/ReajustarValorModal.tsx')
const detail = read('../src/modules/mensalistas/components/MensalistaDetailClient.tsx')
const actions = read('../src/modules/mensalistas/actions/mensalistaActions.ts')
const schema = read('../src/modules/mensalistas/schemas/mensalista.schema.ts')

const DB_ROOT = fileURLToPath(new URL('../../../arenadigital-db/', import.meta.url))
const hasDbRepo = existsSync(DB_ROOT)
const readMigration = (name) =>
  readFileSync(`${DB_ROOT}supabase/migrations/${name}`, 'utf8')
const REAJUSTE = '20260911130000_mensalista_reajuste_escopo_mes.sql'

// ── A vigência é ancorada no mês que o gestor está vendo ──────────────────

test('a competência visualizada chega até a RPC', () => {
  assert.match(detail, /competencia=\{`\$\{competencia\}-01`\}/, 'a tela passa o mês que exibe')
  assert.match(modal, /competencia,\n\s*observacao: obs\.trim\(\) \|\| null/, 'o modal envia')
  assert.match(schema, /competencia: z\.string\(\)\.regex\(\/\^\\d\{4\}-\\d\{2\}-01\$\//)
  assert.match(actions, /p_competencia: parsed\.competencia/)
})

test('o banco ancora na competência recebida, não no relógio', { skip: !hasDbRepo }, () => {
  const sql = readMigration(REAJUSTE)

  assert.match(
    sql,
    /v_anchor_comp := date_trunc\(\s*\n\s*'month',\s*\n\s*COALESCE\(p_competencia, \(now\(\) AT TIME ZONE 'America\/Sao_Paulo'\)::date\)\s*\n\s*\)::date/,
    'sem isso "mês atual" volta a significar o mês do servidor'
  )
  assert.match(sql, /WHEN 'mes_seguinte' THEN \(v_anchor_comp \+ interval '1 month'\)::date/)
})

test('os rótulos nomeiam o mês em vez de dizer "atual"', () => {
  assert.match(modal, /`Somente \$\{mesAncora\}`/)
  assert.match(modal, /`De \$\{mesAncora\} em diante`/)
  assert.match(modal, /`De \$\{mesSeguinte\} em diante`/)
  assert.doesNotMatch(modal, /'Mês atual'/, 'rótulo ambíguo removido')
  assert.doesNotMatch(modal, /'Mês seguinte'/)
})

// ── Ajuste pontual de um mês só ───────────────────────────────────────────

test('"somente este mês" não altera o valor do plano', { skip: !hasDbRepo }, () => {
  const sql = readMigration(REAJUSTE)

  assert.match(
    sql,
    /IF p_escopo <> 'somente_mes' THEN\s*\n\s*UPDATE public\.planos_mensalista\s*\n\s*SET valor_mensal = v_novo/,
    'o ajuste pontual é o único escopo que não troca valor_mensal'
  )
})

test('"somente este mês" toca exatamente uma competência', { skip: !hasDbRepo }, () => {
  const sql = readMigration(REAJUSTE)

  assert.match(
    sql,
    /\(p_escopo = 'somente_mes' AND mensalidade\.competencia = v_vigencia_comp\)/,
    'igualdade, não >='
  )
  assert.match(
    sql,
    /\(p_escopo <> 'somente_mes' AND mensalidade\.competencia >= v_vigencia_comp\)/
  )
})

test('o novo escopo é aceito no histórico e na validação', { skip: !hasDbRepo }, () => {
  const sql = readMigration(REAJUSTE)
  assert.match(sql, /CHECK \(escopo IN \('mes_atual', 'mes_seguinte', 'somente_mes'\)\)/)
  assert.match(sql, /p_escopo NOT IN \('mes_atual', 'mes_seguinte', 'somente_mes'\)/)
  assert.match(schema, /z\.enum\(\['mes_atual', 'mes_seguinte', 'somente_mes'\]\)/)
})

// ── O reajuste respeita a regra de cobrança do plano ──────────────────────

test('reajustar plano por blocos reaplica a proporção, não grava valor fixo', { skip: !hasDbRepo }, () => {
  const sql = readMigration(REAJUSTE)

  // um plano de quinta reajustado para R$ 550 tem que virar R$ 440 num mês de 4
  assert.match(
    sql,
    /v_valor_comp := COALESCE\(\s*\n\s*private\.mensalista_valor_competencia\(\s*\n\s*v_plan\.id, v_mensalidade\.competencia, v_novo\s*\n\s*\),/
  )
  // e o ajuste pontual grava exatamente o que o gestor digitou
  assert.match(sql, /IF p_escopo = 'somente_mes' THEN\s*\n\s*v_valor_comp := v_novo;/)
})

test('a regra de cobrança tem uma fonte só, usada pelos dois caminhos', { skip: !hasDbRepo }, () => {
  const schemaSql = readMigration('20260909120000_mensalista_blocos_schema.sql')
  const generate = readMigration('20260909120030_mensalista_blocos_prorata.sql')
  const reajuste = readMigration(REAJUSTE)

  assert.match(schemaSql, /CREATE OR REPLACE FUNCTION private\.mensalista_valor_competencia/)
  assert.match(generate, /private\.mensalista_valor_competencia\(/, 'generate usa a função')
  assert.match(reajuste, /private\.mensalista_valor_competencia\(/, 'reajuste também')

  // a fórmula não pode estar duplicada fora dela
  assert.doesNotMatch(
    generate,
    /v_month_minutes \/ v_full_minutes/,
    'fórmula duplicada em generate — vai sair do ar da função'
  )
  assert.doesNotMatch(reajuste, /v_month_minutes \/ v_full_minutes/)
})

test('a assinatura antiga é removida para não virar sobrecarga ambígua', { skip: !hasDbRepo }, () => {
  const sql = readMigration(REAJUSTE)
  assert.match(
    sql,
    /DROP FUNCTION IF EXISTS public\.reajustar_plano_mensalista_atomic\(uuid,uuid,uuid,numeric,text,text,uuid\)/
  )
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION public\.reajustar_plano_mensalista_atomic\(uuid,uuid,uuid,numeric,text,date,text,uuid\) FROM PUBLIC, anon, authenticated, service_role/
  )
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION public\.reajustar_plano_mensalista_atomic\(uuid,uuid,uuid,numeric,text,date,text,uuid\) TO service_role/
  )
})

test('o mês de vigência é materializado antes de ser reescrito', { skip: !hasDbRepo }, () => {
  const sql = readMigration(REAJUSTE)
  // o mês âncora, com o valor antigo, para "mês seguinte" não vazar para ele
  assert.match(
    sql,
    /PERFORM public\.generate_mensalista_mensalidades_atomic\(\s*\n\s*p_arena_id, v_anchor_comp, p_registered_by\s*\n\s*\)/
  )
  // e o de vigência, quando for outro — senão não há linha para ajustar
  assert.match(
    sql,
    /IF v_vigencia_comp <> v_anchor_comp THEN[\s\S]{0,220}p_arena_id, v_vigencia_comp, p_registered_by/
  )
})

test('a tela conta o que aconteceu, sem prometer o que não fez', () => {
  assert.match(modal, /d\.escopo === 'somente_mes'/)
  assert.match(modal, /O plano segue em \$\{formatCurrency\(valorAtual\)\}\/mês/)
  assert.match(actions, /escopo: String\(row\.escopo \?\? parsed\.escopo\)/)
})
