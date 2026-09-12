import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  descricaoCreditoJogoCancelado,
  diaCurto,
  faixaHoraria,
} from '../src/modules/bookings/lib/cancelamento-sessao.ts'

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')

const actions = read('../src/modules/bookings/actions/mensalistaActions.ts')
const modal = read('../src/modules/bookings/components/CancelarSessaoMensalistaModal.tsx')
const details = read('../src/modules/bookings/components/BookingDetailsModal.tsx')
const mensalistaDetail = read('../src/modules/mensalistas/components/MensalistaDetailClient.tsx')

const DB_ROOT = fileURLToPath(new URL('../../../arenadigital-db/', import.meta.url))
const hasDbRepo = existsSync(DB_ROOT)
const migration = () =>
  readFileSync(`${DB_ROOT}supabase/migrations/20260911120000_mensalista_cancel_session.sql`, 'utf8')

// ── Texto que o gestor vê meses depois no extrato ─────────────────────────

test('a descrição do crédito é exatamente a combinada', () => {
  assert.equal(
    descricaoCreditoJogoCancelado('2026-09-25T14:00:00-03:00'),
    'Crédito lançado referente a jogo não realizado do dia 25/09/2026'
  )
})

test('dia e horário são mostrados para o gestor conferir o que cancela', () => {
  assert.equal(diaCurto('2026-09-25T14:00:00-03:00'), '25/09/2026')
  assert.equal(
    faixaHoraria('2026-09-25T14:00:00-03:00', '2026-09-25T15:00:00-03:00'),
    '14:00 às 15:00'
  )
})

test('a virada do mês não desloca o dia da descrição', () => {
  assert.equal(
    descricaoCreditoJogoCancelado('2026-09-30T23:00:00-03:00'),
    'Crédito lançado referente a jogo não realizado do dia 30/09/2026'
  )
})

// ── Escopo: um jogo, não a recorrência ────────────────────────────────────

test('o cancelamento não encosta em plano, mensalidade ou cobrança', { skip: !hasDbRepo }, () => {
  const sql = migration()
  const fn = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.cancel_mensalista_booking_atomic'))

  assert.doesNotMatch(fn, /UPDATE public\.planos_mensalista/, 'não mexe no plano')
  assert.doesNotMatch(fn, /public\.mensalista_mensalidades/, 'não mexe na mensalidade')
  assert.doesNotMatch(fn, /public\.mensalista_cobrancas/, 'não mexe nas cobranças')
  assert.doesNotMatch(fn, /public\.transactions/, 'cancelar não é evento de caixa')

  // o que ele faz: cancela a reserva e, opcionalmente, credita
  assert.match(fn, /UPDATE public\.bookings\s*\n\s*SET status = 'cancelled'/)
  assert.match(fn, /INSERT INTO public\.mensalista_creditos/)
})

test('a UI diz que o cancelamento é só daquele dia', () => {
  assert.match(modal, /somente este jogo/)
  assert.match(modal, /A recorrência do/)
  assert.match(modal, /mensalidade do mês/)
  // e mostra dia e horário do jogo
  assert.match(modal, /diaExtenso\(startTime\)/)
  assert.match(modal, /faixaHoraria\(startTime, endTime\)/)
})

// ── Valor do crédito ──────────────────────────────────────────────────────

test('o valor sugerido vem da tabela de preço do plano, resolvido no banco', () => {
  const quote = actions.slice(
    actions.indexOf('export async function quoteSessaoMensalistaAction'),
    actions.indexOf('const cancelarSessaoSchema')
  )
  assert.ok(quote.length > 0, 'action localizada')

  // cadeia: snapshot do plano → tabela do papel mensalista → padrão do espaço
  assert.match(quote, /plano\?\.price_table_id \?\? null/)
  assert.match(quote, /\.eq\('tipo', 'mensalista'\)/, 'o papel é resolvido por tipo, nunca por nome')
  assert.match(quote, /origem = 'padrao'/)

  // e o valor sai da função canônica do banco
  assert.match(quote, /\.rpc\('resolve_court_price'/)
  assert.doesNotMatch(quote, /basePrice|preco_base|\* 60|\/ 60/, 'sem conta de preço no cliente')
})

test('a tela avisa quando a sugestão caiu na tabela padrão', () => {
  assert.match(modal, /quote\.origem === 'padrao'/)
  assert.match(modal, /tabela padrão do espaço/)
  assert.match(modal, /Você pode ajustar o valor/, 'o valor segue editável')
})

// ── Autorização e idempotência ────────────────────────────────────────────

test('as duas actions novas exigem backoffice da arena', () => {
  for (const fn of ['quoteSessaoMensalistaAction', 'cancelarSessaoMensalistaAction']) {
    const body = actions.slice(actions.indexOf(`export async function ${fn}`))
    assert.match(body.slice(0, 700), /await assertArenaBackofficeAccess\(/, `${fn} sem checagem`)
  }
  assert.match(actions, /await requireAuthenticatedDbUser\(\)/)
})

test('duplo clique não credita duas vezes', { skip: !hasDbRepo }, () => {
  // no cliente: chave de idempotência por operação
  assert.match(modal, /operationId: crypto\.randomUUID\(\)/)

  const sql = migration()
  // no banco: um crédito por reserva, garantido por índice
  assert.match(
    sql,
    /CREATE UNIQUE INDEX IF NOT EXISTS mensalista_creditos_one_per_booking[\s\S]{0,140}WHERE booking_id IS NOT NULL/
  )
  // e cancelar de novo devolve o estado em vez de estourar
  assert.match(sql, /IF v_booking\.status = 'cancelled' THEN[\s\S]{0,700}'idempotent', true/)
})

test('a RPC recusa reserva que não é de plano mensalista', { skip: !hasDbRepo }, () => {
  assert.match(
    migration(),
    /v_booking\.plano_mensalista_id IS NULL THEN[\s\S]{0,160}RAISE EXCEPTION/
  )
})

test('o crédito vai para o titular do plano, não para quem estiver na reserva', { skip: !hasDbRepo }, () => {
  const sql = migration()
  assert.match(sql, /SELECT plano\.athlete_id INTO v_atleta_id/)
  assert.match(sql, /FROM public\.planos_mensalista plano/)
})

// ── Migração: forma e ACL ─────────────────────────────────────────────────

test('a migração é reexecutável e fecha a ACL', { skip: !hasDbRepo }, () => {
  const sql = migration()

  assert.match(sql, /ADD COLUMN IF NOT EXISTS booking_id uuid/)
  assert.match(sql, /ON DELETE SET NULL/, 'apagar a reserva não pode sumir com o crédito')
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS/)
  assert.doesNotMatch(sql, /CREATE FUNCTION\s/, 'CREATE FUNCTION sem OR REPLACE')

  const functions = sql.match(/CREATE OR REPLACE FUNCTION/g)?.length ?? 0
  assert.equal(sql.match(/SET search_path = ''/g)?.length, functions)

  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION public\.cancel_mensalista_booking_atomic\([^)]*\) FROM PUBLIC, anon, authenticated, service_role/
  )
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION public\.cancel_mensalista_booking_atomic\([^)]*\) TO service_role/
  )
})

// ── Entrada pela tela da reserva e saída em Mensalistas ───────────────────

test('o botão só aparece em reserva de mensalista ainda ativa', () => {
  assert.match(
    details,
    /const canCancelSessaoMensalista = isMensalista && booking\.status !== "cancelled"/
  )
  assert.match(details, /Cancelar este dia/)
  // reserva de mensalista já confirmada (mês pago) também pode ser cancelada —
  // é justamente o caso que gera crédito
  assert.doesNotMatch(
    details,
    /canCancelSessaoMensalista = [^\n]*confirmed/,
    'não pode exigir que a reserva esteja em aberto'
  )
})

test('o crédito aparece em Mensalistas identificado como jogo cancelado', () => {
  assert.match(mensalistaDetail, /function creditoBookingId/)
  assert.match(mensalistaDetail, /Jogo cancelado/)
  assert.match(mensalistaDetail, /Crédito gerado pelo cancelamento de um jogo da recorrência/)
})

test('a tela de mensalistas é revalidada ao cancelar', () => {
  const body = actions.slice(actions.indexOf('export async function cancelarSessaoMensalistaAction'))
  assert.match(body, /revalidatePath\(`\/dashboard\/arenas\/\$\{parsed\.arenaId\}\/mensalistas`\)/)
})
