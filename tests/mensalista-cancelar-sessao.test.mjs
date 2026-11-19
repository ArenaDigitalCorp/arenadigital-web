// `cancelamento-sessao.ts` usa `date-fns` puro (sem `date-fns-tz`), que formata
// no fuso LOCAL do runtime — mesma convenção do resto do código de cliente deste
// projeto (ver comentário em mensalista-blocos.ts: "o horário vai no fuso do
// navegador do gestor"). Fixa o fuso do processo ANTES de qualquer import que
// use Date/date-fns, para o teste não depender do fuso de quem o executa: sem
// isso ele passava na minha máquina (America/Sao_Paulo) e falhava na CI (UTC),
// porque `-03:00` embutido na fixture só "bate" quando o fuso local já é esse.
process.env.TZ = 'America/Sao_Paulo'

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  blocosDeHora,
  descricaoCreditoHorariosCancelados,
  descricaoCreditoJogoCancelado,
  diaCurto,
  faixaHoraria,
  selecaoDeCancelamento,
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

  // Em outra quadra, os papéis reservados são identificados pelo tipo.
  assert.match(quote, /plano\.court_id === booking\.court_id \? plano\.price_table_id/)
  assert.match(quote, /\.eq\('tipo', papel\)/, 'o papel é resolvido por tipo, nunca por nome')
  assert.match(quote, /origem = 'padrao'/)

  // e o valor sai da função canônica do banco
  assert.match(quote, /\.rpc\('resolve_court_price'/)
  assert.doesNotMatch(quote, /basePrice|preco_base|\* 60|\/ 60/, 'sem conta de preço no cliente')
})

test('a tela avisa quando a sugestão caiu na tabela padrão', () => {
  assert.match(modal, /quoteAtual\.origem === 'padrao'/)
  assert.match(modal, /tabela padrão do espaço/)
  assert.match(modal, /Você pode ajustar o valor/, 'o valor segue editável')
})

// ── Autorização e idempotência ────────────────────────────────────────────

test('as duas actions novas exigem backoffice da arena', () => {
  for (const fn of ['quoteSessaoMensalistaAction', 'cancelarSessaoMensalistaAction']) {
    const body = actions.slice(actions.indexOf(`export async function ${fn}`))
    assert.match(body.slice(0, 700), /await assertArenaResourceAccess\(/, `${fn} sem checagem`)
  }
  assert.match(actions, /await requireAuthenticatedDbUser\(\)/)
})

test('duplo clique não credita duas vezes', { skip: !hasDbRepo }, () => {
  // no cliente: chave de idempotência por operação
  assert.match(modal, /operacoes\.current\.get\(key\) \?\? crypto\.randomUUID\(\)/)

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
  assert.match(details, /Cancelar dia ou horário/)
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

// ── Cancelar só parte do jogo (ex.: a 1ª hora) ────────────────────────────

const partialMigration = () =>
  readFileSync(`${DB_ROOT}supabase/migrations/20260929120000_mensalista_cancel_partial_session.sql`, 'utf8')

test('a sessão vira blocos de 1h para o gestor escolher o que cancelar', () => {
  const blocos = blocosDeHora('2026-09-29T20:00:00-03:00', '2026-09-29T23:00:00-03:00')
  assert.deepEqual(
    blocos.map((b) => faixaHoraria(b.inicio, b.fim)),
    ['20:00 às 21:00', '21:00 às 22:00', '22:00 às 23:00']
  )
  // sessão com meia hora sobrando: o último bloco é menor
  const quebrada = blocosDeHora('2026-09-29T20:00:00-03:00', '2026-09-29T21:30:00-03:00')
  assert.deepEqual(quebrada.map((b) => faixaHoraria(b.inicio, b.fim)), ['20:00 às 21:00', '21:00 às 21:30'])
})

test('a seleção do vídeo preserva o intervalo das 08h às 10h e lista as duas faixas no crédito', () => {
  const dia = '2026-11-19T07:00:00-03:00'
  const blocos = blocosDeHora(dia, '2026-11-19T11:00:00-03:00')
  const selecao = selecaoDeCancelamento(blocos, [3, 0, 0])
  assert.deepEqual(selecao, { intervalos: [blocos[0], blocos[3]], sessaoInteira: false })
  assert.equal(
    descricaoCreditoHorariosCancelados(dia, selecao.intervalos),
    'Crédito lançado referente a jogo não realizado do dia 19/11/2026 (07:00 às 08:00 e 10:00 às 11:00)'
  )
})

test('a seleção agrupa vizinhos e preserva lacunas, a meia hora final e os blocos originais', () => {
  const blocos = blocosDeHora('2026-11-19T07:00:00-03:00', '2026-11-19T11:30:00-03:00')
  const originais = structuredClone(blocos)
  assert.deepEqual(selecaoDeCancelamento(blocos, [4, 0, 3, 1, -1, 5]), {
    intervalos: [{ inicio: blocos[0].inicio, fim: blocos[1].fim }, { inicio: blocos[3].inicio, fim: blocos[4].fim }],
    sessaoInteira: false,
  })
  assert.deepEqual(selecaoDeCancelamento(blocos, [4, 1, 3, 2, 0]), {
    intervalos: [{ inicio: blocos[0].inicio, fim: blocos[4].fim }], sessaoInteira: true,
  })
  assert.deepEqual(selecaoDeCancelamento(blocos, []), { intervalos: [], sessaoInteira: false })
  assert.deepEqual(selecaoDeCancelamento(blocos, [1]), { intervalos: [blocos[1]], sessaoInteira: false })
  assert.deepEqual(blocos, originais)
})

test('a descrição continua identificando o dia e o horário no cancelamento de uma única faixa', () => {
  const dia = '2026-09-29T20:00:00-03:00'
  assert.equal(
    descricaoCreditoHorariosCancelados(dia, blocosDeHora(dia, '2026-09-29T21:00:00-03:00')),
    'Crédito lançado referente a jogo não realizado do dia 29/09/2026 (20:00 às 21:00)'
  )
})

test('a gravação escolhe uma única RPC para todos os horários da confirmação', () => {
  const body = actions.slice(actions.indexOf('export async function cancelarSessaoMensalistaAction'))
  assert.match(body, /cancel_mensalista_booking_partial_atomic/)
  assert.match(body, /cancel_mensalista_booking_ranges_atomic/)
  assert.match(body, /p_intervalos: parsed.intervalos.map/)
  assert.match(modal, /aria-label="Horários a cancelar"/)
})

test('liberar o horário = encurtar/dividir a reserva; plano e mensalidade intactos', { skip: !hasDbRepo }, () => {
  const sql = partialMigration()
  assert.match(sql, /SET end_time = p_cancel_start/)
  assert.match(sql, /SET start_time = p_cancel_end/)
  assert.match(sql, /RETURN public\.cancel_mensalista_booking_atomic\(/, 'o dia inteiro delega')
  assert.doesNotMatch(sql, /UPDATE public\.planos_mensalista|public\.mensalista_mensalidades|public\.mensalista_cobrancas/)
  assert.doesNotMatch(sql, /public\.transactions/, 'cancelar não é evento de caixa')
})
