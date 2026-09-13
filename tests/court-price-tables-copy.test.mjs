import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { clonePriceTablesToCourt } from '../src/modules/courts/lib/clone-price-tables.ts'

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')

// ── Fake Supabase ─────────────────────────────────────────────────────────
// Só o suficiente para o helper: select/eq/in/order encadeados e resolvidos no
// await, insert().select().single(), insert(array) e delete().eq().

function fakeSupabase(seed) {
  const db = {
    court_price_tables: seed.court_price_tables.map((r) => ({ ...r })),
    court_price_table_days: seed.court_price_table_days.map((r) => ({ ...r })),
    court_price_table_bands: seed.court_price_table_bands.map((r) => ({ ...r })),
  }
  let nextId = 1
  const failures = seed.failOn ?? {}

  const builder = (table) => {
    let rows = db[table]
    let mode = 'select'
    let inserted = null

    const api = {
      select() {
        return api
      },
      eq(column, value) {
        rows = rows.filter((r) => r[column] === value)
        return api
      },
      in(column, values) {
        rows = rows.filter((r) => values.includes(r[column]))
        return api
      },
      order() {
        rows = rows.slice().sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
        return api
      },
      delete() {
        mode = 'delete'
        return api
      },
      insert(payload) {
        mode = 'insert'
        const list = Array.isArray(payload) ? payload : [payload]
        inserted = list.map((row) => ({ ...row, id: `${table}-${nextId++}` }))
        db[table].push(...inserted)
        return api
      },
      single() {
        return Promise.resolve(
          failures[table]
            ? { data: null, error: { message: failures[table] } }
            : { data: inserted?.[0] ?? rows[0] ?? null, error: null }
        )
      },
      then(resolve, reject) {
        if (failures[table]) {
          return Promise.resolve({ data: null, error: { message: failures[table] } }).then(resolve, reject)
        }
        if (mode === 'delete') {
          const removed = new Set(rows.map((r) => r.id))
          db[table] = db[table].filter((r) => !removed.has(r.id))
          return Promise.resolve({ data: null, error: null }).then(resolve, reject)
        }
        return Promise.resolve({ data: mode === 'insert' ? inserted : rows, error: null }).then(resolve, reject)
      },
    }
    return api
  }

  return { db, client: { from: builder } }
}

const ARENA = 'arena-1'
const ORIGEM = 'court-origem'
const DESTINO = 'court-destino'

/**
 * Origem completa: Padrão renomeada, Mensalista com faixa, Professor com dia,
 * uma personalizada — e a padrão do espaço NÃO é a Padrão.
 * Destino como o trigger deixa: 3 tabelas semeadas, só a Padrão com dia.
 */
function cenario(extra = {}) {
  return {
    court_price_tables: [
      { id: 'o1', court_id: ORIGEM, arena_id: ARENA, nome: 'Balcão', tipo: 'padrao', is_default: false, aplica_a: ['avulso'], ativo: true, ordem: 0 },
      { id: 'o2', court_id: ORIGEM, arena_id: ARENA, nome: 'Mensalista', tipo: 'mensalista', is_default: true, aplica_a: ['mensalista'], ativo: true, ordem: 1 },
      { id: 'o3', court_id: ORIGEM, arena_id: ARENA, nome: 'Professor', tipo: 'professor', is_default: false, aplica_a: ['professor'], ativo: false, ordem: 2 },
      { id: 'o4', court_id: ORIGEM, arena_id: ARENA, nome: 'Torneio', tipo: 'custom', is_default: false, aplica_a: [], ativo: true, ordem: 3 },
      { id: 'x1', court_id: DESTINO, arena_id: ARENA, nome: 'Padrão', tipo: 'padrao', is_default: true, aplica_a: ['avulso'], ativo: true, ordem: 0 },
      { id: 'x2', court_id: DESTINO, arena_id: ARENA, nome: 'Mensalista', tipo: 'mensalista', is_default: false, aplica_a: ['mensalista'], ativo: true, ordem: 1 },
      { id: 'x3', court_id: DESTINO, arena_id: ARENA, nome: 'Professor', tipo: 'professor', is_default: false, aplica_a: ['professor'], ativo: true, ordem: 2 },
    ],
    court_price_table_days: [
      { id: 'd1', price_table_id: 'o1', arena_id: ARENA, dia_semana: 2, habilitado: true, hora_inicio: '06:00', hora_fim: '23:00', slot_shift_time: null, preco_base: '120.00' },
      { id: 'd2', price_table_id: 'o2', arena_id: ARENA, dia_semana: 2, habilitado: true, hora_inicio: '06:00', hora_fim: '23:00', slot_shift_time: '06:30', preco_base: '90.00' },
      { id: 'd3', price_table_id: 'o3', arena_id: ARENA, dia_semana: 6, habilitado: true, hora_inicio: '08:00', hora_fim: '12:00', slot_shift_time: null, preco_base: '70.00' },
      { id: 'dx', price_table_id: 'x1', arena_id: ARENA, dia_semana: 2, habilitado: true, hora_inicio: '06:00', hora_fim: '23:00', slot_shift_time: null, preco_base: '120.00' },
    ],
    court_price_table_bands: [
      { id: 'b1', price_table_day_id: 'd2', arena_id: ARENA, hora_inicio: '19:00', hora_fim: '22:00', preco: '110.00', ordem: 0 },
      { id: 'b2', price_table_day_id: 'd1', arena_id: ARENA, hora_inicio: '19:00', hora_fim: '22:00', preco: '150.00', ordem: 0 },
    ],
    ...extra,
  }
}

const doDestino = (db, table) => db[table].filter((r) => r.court_id === DESTINO)

test('a cópia leva as quatro tabelas da origem e descarta as semeadas', async () => {
  const { db, client } = fakeSupabase(cenario())
  await clonePriceTablesToCourt(client, ARENA, ORIGEM, DESTINO)

  const copiadas = doDestino(db, 'court_price_tables').sort((a, b) => a.ordem - b.ordem)
  assert.deepEqual(
    copiadas.map((t) => [t.nome, t.tipo, t.ordem]),
    [['Balcão', 'padrao', 0], ['Mensalista', 'mensalista', 1], ['Professor', 'professor', 2], ['Torneio', 'custom', 3]],
    'nome renomeado, tabela personalizada e ordem vêm junto'
  )
  assert.equal(copiadas.length, 4, 'as 3 tabelas semeadas pelo trigger não sobram no destino')
  assert.ok(copiadas.every((t) => !['x1', 'x2', 'x3'].includes(t.id)))
})

test('a origem não é alterada pela cópia', async () => {
  const seed = cenario()
  const { db, client } = fakeSupabase(seed)
  await clonePriceTablesToCourt(client, ARENA, ORIGEM, DESTINO)

  assert.deepEqual(
    db.court_price_tables.filter((r) => r.court_id === ORIGEM).map((r) => r.id),
    ['o1', 'o2', 'o3', 'o4']
  )
})

test('is_default e ativo seguem a origem, não a semente do trigger', async () => {
  const { db, client } = fakeSupabase(cenario())
  await clonePriceTablesToCourt(client, ARENA, ORIGEM, DESTINO)

  const copiadas = doDestino(db, 'court_price_tables')
  const padroes = copiadas.filter((t) => t.is_default)
  assert.equal(padroes.length, 1, 'exatamente uma padrão por espaço')
  assert.equal(padroes[0].tipo, 'mensalista', 'a padrão da origem continua sendo a padrão')
  assert.equal(copiadas.find((t) => t.tipo === 'professor').ativo, false, 'tabela inativa continua inativa')
})

test('dias e faixas da Mensalista chegam ao novo espaço', async () => {
  const { db, client } = fakeSupabase(cenario())
  await clonePriceTablesToCourt(client, ARENA, ORIGEM, DESTINO)

  const mensalista = doDestino(db, 'court_price_tables').find((t) => t.tipo === 'mensalista')
  const dias = db.court_price_table_days.filter((d) => d.price_table_id === mensalista.id)
  assert.equal(dias.length, 1)
  assert.deepEqual(
    { dia: dias[0].dia_semana, ini: dias[0].hora_inicio, fim: dias[0].hora_fim, shift: dias[0].slot_shift_time, base: dias[0].preco_base },
    { dia: 2, ini: '06:00', fim: '23:00', shift: '06:30', base: 90 },
    'slot_shift_time e preço base preservados'
  )

  const faixas = db.court_price_table_bands.filter((b) => b.price_table_day_id === dias[0].id)
  assert.deepEqual(
    faixas.map((b) => [b.hora_inicio, b.hora_fim, b.preco]),
    [['19:00', '22:00', 110]],
    'a faixa de exceção da Mensalista veio junto — era o que o trigger perdia'
  )
})

test('cada dia copiado fica com as faixas do seu próprio dia', async () => {
  const { db, client } = fakeSupabase(cenario())
  await clonePriceTablesToCourt(client, ARENA, ORIGEM, DESTINO)

  const porTabela = new Map(doDestino(db, 'court_price_tables').map((t) => [t.tipo, t.id]))
  const diaDe = (tipo) => db.court_price_table_days.find((d) => d.price_table_id === porTabela.get(tipo))
  const faixasDe = (tipo) => db.court_price_table_bands.filter((b) => b.price_table_day_id === diaDe(tipo)?.id)

  assert.deepEqual(faixasDe('padrao').map((b) => b.preco), [150])
  assert.deepEqual(faixasDe('mensalista').map((b) => b.preco), [110])
  assert.deepEqual(faixasDe('professor').map((b) => b.preco), [], 'dia sem faixa não herda faixa de outro dia')
})

test('tabela personalizada sem dias é copiada mesmo assim', async () => {
  const { db, client } = fakeSupabase(cenario())
  await clonePriceTablesToCourt(client, ARENA, ORIGEM, DESTINO)

  const torneio = doDestino(db, 'court_price_tables').find((t) => t.nome === 'Torneio')
  assert.ok(torneio, 'a tabela personalizada existe no destino')
  assert.equal(db.court_price_table_days.filter((d) => d.price_table_id === torneio.id).length, 0)
})

test('origem sem tabelas mantém as semeadas em vez de esvaziar o destino', async () => {
  const seed = cenario()
  seed.court_price_tables = seed.court_price_tables.filter((r) => r.court_id === DESTINO)
  const { db, client } = fakeSupabase(seed)

  await clonePriceTablesToCourt(client, ARENA, ORIGEM, DESTINO)

  assert.equal(doDestino(db, 'court_price_tables').length, 3, 'o destino não fica sem tabela de preço')
})

test('falha ao ler a origem aborta antes de apagar o destino', async () => {
  // Falha na leitura dos dias: o delete das tabelas do destino roda logo depois
  // e passaria sem erro — só não roda porque a origem é lida inteira antes.
  const seed = cenario({ failOn: { court_price_table_days: 'timeout' } })
  const { db, client } = fakeSupabase(seed)

  await assert.rejects(() => clonePriceTablesToCourt(client, ARENA, ORIGEM, DESTINO), /timeout/)
  assert.equal(doDestino(db, 'court_price_tables').length, 3, 'o destino não fica sem tabela de preço')
  assert.deepEqual(doDestino(db, 'court_price_tables').map((t) => t.id), ['x1', 'x2', 'x3'])
})

// ── Contrato com o restante do fluxo ──────────────────────────────────────

test('duplicateCourtAction copia as tabelas e avisa sem derrubar o espaço criado', () => {
  const courtActions = read('../src/modules/courts/actions/courtActions.ts')

  assert.match(courtActions, /clonePriceTablesToCourt\(supabase, arenaId, courtId, court\.id\)/)
  assert.match(courtActions, /catch \(cloneError\)/, 'falha na cópia não desfaz o espaço já criado')
  assert.match(courtActions, /warning/)

  const client = read('../src/modules/arenas/components/ArenaDetailPageClient.tsx')
  assert.match(client, /res\.warning/, 'a tela mostra o aviso quando as tabelas não vieram')
})
