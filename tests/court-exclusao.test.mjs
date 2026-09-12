import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')

const actions = read('../src/modules/courts/actions/courtActions.ts')
const dialog = read('../src/modules/courts/components/ExcluirEspacoDialog.tsx')
const arenaClient = read('../src/modules/arenas/components/ArenaDetailPageClient.tsx')

const DB_ROOT = fileURLToPath(new URL('../../../arenadigital-db/', import.meta.url))
const hasDbRepo = existsSync(DB_ROOT)
const baseline = () =>
  readFileSync(`${DB_ROOT}supabase/migrations/20260626000000_baseline_schema.sql`, 'utf8')

// ── Por que a exclusão precisa de guarda ──────────────────────────────────

test('apagar um espaço levaria as reservas junto, por CASCADE', { skip: !hasDbRepo }, () => {
  // É esta linha que torna "Excluir espaço" perigoso: sem guarda no servidor,
  // apagar a quadra apaga silenciosamente todo o histórico de reservas.
  assert.match(
    baseline(),
    /ADD CONSTRAINT "bookings_court_id_fkey" FOREIGN KEY \("court_id"\) REFERENCES "public"\."courts"\("id"\) ON DELETE CASCADE/
  )
})

test('e os lançamentos de caixa não caem junto — ficariam órfãos', { skip: !hasDbRepo }, () => {
  // `transactions` não tem FK para bookings; o dinheiro permanece no caixa, mas
  // perde a reserva que o originou. É o argumento para desativar em vez de excluir.
  assert.doesNotMatch(baseline(), /transactions[a-z_]*_booking_id_fkey/)
})

// ── O servidor decide, não a tela ─────────────────────────────────────────

test('a exclusão refaz o levantamento no servidor antes de apagar', () => {
  const corpo = actions.slice(actions.indexOf('export async function deleteCourtAction'))
  assert.match(corpo, /const impacto = await getCourtDeletionImpactAction\(arenaId, courtId\)/)
  assert.match(
    corpo,
    /if \(!impacto\.data\.podeExcluir\) \{[\s\S]{0,220}throw new Error\(/,
    'a tela não é fronteira de segurança'
  )
  // e a checagem vem ANTES do delete
  assert.ok(
    corpo.indexOf('podeExcluir') < corpo.indexOf(".from('courts')\n            .delete()"),
    'a guarda tem que preceder o delete'
  )
})

test('só é excluído espaço sem histórico nenhum', () => {
  const corpo = actions.slice(
    actions.indexOf('export async function getCourtDeletionImpactAction'),
    actions.indexOf('export async function setCourtActiveAction')
  )
  assert.match(corpo, /podeExcluir: bloqueios\.length === 0/)
  // os três que impedem
  assert.match(corpo, /if \(reservas > 0\)/)
  assert.match(corpo, /if \(planosMensalistas > 0\)/)
  assert.match(corpo, /if \(solicitacoes > 0\)/)
})

test('reserva cancelada não conta como histórico', () => {
  const corpo = actions.slice(actions.indexOf('export async function getCourtDeletionImpactAction'))
  assert.match(corpo, /\.neq\('status', 'cancelled'\)/)
})

test('o levantamento sobrevive a tabela que ainda não existe no ambiente', () => {
  // `planos_mensalista_blocos` só existe depois da migração de blocos. Contar
  // zero é melhor do que derrubar o diálogo inteiro.
  assert.match(actions, /Tabela ainda não existe neste ambiente/)
  assert.match(actions, /if \(error\) return 0/)
  assert.match(actions, /planos_mensalista_blocos/)
})

// ── Desativar ─────────────────────────────────────────────────────────────

test('desativar usa o campo que o banco de fato checa', () => {
  const corpo = actions.slice(actions.indexOf('export async function setCourtActiveAction'))
  assert.match(corpo, /status: ativo \? 'ativo' : 'inativo'/)
  assert.match(corpo, /is_active: ativo/)
  // e é reversível pelo mesmo caminho
  assert.match(actions, /setCourtActiveAction\(arenaId: string, courtId: string, ativo: boolean\)/)
})

test('desativar continua sendo autorizado como admin da arena', () => {
  for (const fn of ['getCourtDeletionImpactAction', 'setCourtActiveAction', 'deleteCourtAction']) {
    const corpo = actions.slice(actions.indexOf(`export async function ${fn}`))
    assert.match(corpo.slice(0, 400), /await assertArenaAdminAccess\(arenaId\)/, `${fn} sem admin`)
    assert.match(corpo.slice(0, 400), /await assertCourtAccess\(courtId, arenaId\)/, `${fn} sem escopo`)
  }
})

// ── O aviso que o gestor lê antes de confirmar ────────────────────────────

test('o diálogo mostra o que está vinculado antes de qualquer ação', () => {
  assert.match(dialog, /getCourtDeletionImpactAction/)
  for (const item of [
    /Reservas no histórico/,
    /Reservas futuras/,
    /Recorrências de mensalista/,
    /Solicitações do app/,
    /Tabelas de preço/,
  ]) {
    assert.match(dialog, item)
  }
})

test('o diálogo diz o que cada caminho aplica', () => {
  // excluir
  assert.match(dialog, /A exclusão é permanente/)
  assert.match(dialog, /tabelas de preço<\/strong> e os/)
  // desativar
  assert.match(dialog, /impede novas reservas, novas/)
  assert.match(dialog, /As reservas já marcadas/)
  assert.match(dialog, /histórico fica intacto/)
  // e o motivo quando não dá para excluir
  assert.match(dialog, /não pode ser excluído<\/strong> porque tem/)
  assert.match(dialog, /os lançamentos de caixa perderiam a reserva/)
})

test('o botão de excluir fica desabilitado quando há histórico', () => {
  assert.match(dialog, /disabled=\{ocupado \|\| !impacto\?\.podeExcluir\}/)
  assert.match(dialog, /Espaço com histórico não pode ser excluído — use Desativar/)
})

test('reativar é oferecido pelo mesmo diálogo', () => {
  assert.match(dialog, /const inativo = court\?\.status === 'inativo'/)
  assert.match(dialog, /\{inativo \? 'Reativar espaço' : 'Desativar espaço'\}/)
})

// ── Entrada pelo menu do espaço ───────────────────────────────────────────

test('o menu anuncia os dois caminhos, não só "Excluir"', () => {
  assert.match(arenaClient, /'Reativar ou excluir'/)
  assert.match(arenaClient, /'Desativar ou excluir'/)
  assert.match(arenaClient, /<ExcluirEspacoDialog/)
})

test('a lista reage às duas ações', () => {
  assert.match(arenaClient, /onDeleted=\{\(courtId: string\) =>/)
  assert.match(arenaClient, /prev\.filter\(\(c\) => c\.id !== courtId\)/)
  assert.match(arenaClient, /onStatusChanged=/)
  assert.match(arenaClient, /prev\.map\(\(c\) =>/)
})

test('o diálogo genérico antigo saiu de cena', () => {
  assert.doesNotMatch(arenaClient, /title="Excluir espaço"/)
  assert.doesNotMatch(arenaClient, /isDeletingSpace/, 'estado morto removido')
})
