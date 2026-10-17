import assert from 'node:assert/strict'
import test from 'node:test'
import { hookController } from './helpers/hook-controller.mjs'

const tick = () => new Promise(resolve => setImmediate(resolve))
const athlete = id => ({ id, nome: id, membro: true, niveis: {} })
const catalog = () => ({ atletas: [athlete('Alice'), athlete('Bruna')], esportes: [], espacos: [], professores: [], recorrencias: [] })
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : []
const text = tree => Array.isArray(tree) ? tree.map(text).join('') : tree && typeof tree === 'object' ? text(tree.props?.children) : String(tree ?? '')

function catalogFixture() {
  const requests = []
  const args = [{ arenaId: 'arena', catalogo: catalog(), title: 'Alunos', onClose() {},
    children: (catalogo, catalogState) => ({ type: 'StudentModal', props: { catalogo, catalogState } }) }]
  const h = hookController('src/modules/turmas/components/TurmasAthleteCatalog.tsx', 'TurmasAthleteCatalog', args, {
    '../actions': { getTurmasAthleteOptionsAction: () => new Promise(resolve => requests.push(resolve)) },
    '@/components/ui/standard-modal': { StandardModal: 'LoadingModal' }, '@/components/ui/button': { Button: 'button' },
  })
  return { ...h, args, requests, async resolve(index, data = catalog().atletas) { requests[index]({ success: true, data }); await tick() } }
}

test('a server refresh keeps the same modal mounted and blocks writes until the new full catalogue arrives', async () => {
  const h = catalogFixture()
  assert.equal(h.render().type, 'LoadingModal')
  await h.resolve(0)
  assert.equal(h.render().props.catalogState.ready, true)
  h.args[0] = { ...h.args[0], catalogo: catalog() }
  let tree = h.render()
  assert.equal(tree.type, 'StudentModal')
  assert.equal(tree.props.catalogState.ready, false)
  assert.match(text(tree.props.catalogState.feedback), /Atualizando/)
  await h.resolve(1, [athlete('Bruna')])
  tree = h.render()
  assert.equal(tree.type, 'StudentModal')
  assert.equal(tree.props.catalogState.ready, true)
  assert.equal(tree.props.catalogo.atletas.find(a => a.id === 'Alice').membro, false)
  h.unmount()
})

test('refresh failure and retry retain the modal and draft boundary, and ignore superseded reads', async () => {
  const h = catalogFixture(); h.render(); await h.resolve(0); h.render()
  h.args[0] = { ...h.args[0], catalogo: catalog() }; h.render()
  h.requests[1]({ success: false, error: 'Indisponível' }); await tick()
  let tree = h.render()
  assert.equal(tree.type, 'StudentModal'); assert.equal(tree.props.catalogState.ready, false)
  nodes(tree.props.catalogState.feedback).find(n => n.type === 'button').props.onClick()
  assert.equal(h.render().type, 'StudentModal')
  h.args[0] = { ...h.args[0], catalogo: catalog() }; h.render()
  await h.resolve(3, [athlete('Bruna')]); assert.equal(h.render().props.catalogState.ready, true)
  await h.resolve(2, [athlete('Alice')])
  tree = h.render()
  assert.equal(tree.props.catalogo.atletas.find(a => a.id === 'Alice').membro, false)
  h.unmount()
})

test('another arena never receives the previous arena member catalogue', async () => {
  const h = catalogFixture(); h.render(); await h.resolve(0); h.render()
  h.args[0] = { ...h.args[0], arenaId: 'other' }
  assert.equal(h.render().type, 'LoadingModal')
  h.unmount(); await h.resolve(1)
  assert.equal(h.render().type, 'LoadingModal')
})

function studentFixture() {
  const calls = [], props = {
    arenaId: 'arena', turma: { id: 'turma', codigo: 'BT-001', status: 'ativa', esporteId: 'sport', nivelIds: [], criadaEm: '2026-01-01', vagas: null, matriculas: [], recorrencia: { trechos: [] } },
    catalogo: catalog(), catalogState: { ready: true, feedback: null }, onFechar() {}, onAlterado() {}, onAbrirAtleta() {},
  }
  const args = [props]
  const h = hookController('src/modules/turmas/components/TurmaAlunosModal.tsx', 'TurmaAlunosModal', args, {
    '../actions': { async vincularAlunoAction(input) { calls.push(input); return { success: true } }, async desvincularAlunoAction(input) { calls.push(input); return { success: true } } },
    './Ordenavel': { Ordenavel: 'sort', useOrdenacao: rows => ({ ordenados: rows, ordem: {}, alternar() {} }) },
    '@/components/ui/standard-modal': { StandardModal: 'Modal' }, '@/components/ui/input': { Input: 'input' },
    '@/components/ui/button': { Button: 'button' }, '@/components/dashboard/DashboardTabs': { DashboardTabs: 'tabs' },
    sonner: { toast: { success() {}, error() {} } },
  })
  const select = name => {
    nodes(h.render()).find(n => n.props?.placeholder === 'Buscar atleta da arena').props.onChange({ target: { value: name } })
    nodes(h.render()).find(n => n.type === 'button' && text(n) === name).props.onClick()
  }
  const link = () => nodes(h.render()).find(n => n.type === 'button' && text(n).trim() === 'Vincular')
  return { ...h, props, args, calls, select, link }
}

test('consecutive student enrollments retain the chosen backdated entry across a server refresh', async () => {
  const h = studentFixture()
  nodes(h.render()).find(n => n.props?.id === 'turma-entrada').props.onChange({ target: { value: '2026-02-10' } })
  h.select('Alice'); h.link().props.onClick(); await tick()
  h.props.turma = { ...h.props.turma, matriculas: [{ id: h.calls[0].matriculaId, atletaId: 'Alice', entrada: '2026-02-10', saida: null }] }
  h.props.catalogState = { ready: false, feedback: null }
  h.select('Bruna')
  assert.equal(h.link().props.disabled, true)
  await h.link().props.onClick(); assert.equal(h.calls.length, 1)
  h.props.catalogo = catalog(); h.props.catalogState = { ready: true, feedback: null }
  assert.equal(nodes(h.render()).find(n => n.props?.id === 'turma-entrada').props.value, '2026-02-10')
  h.link().props.onClick(); await tick()
  assert.equal(h.calls.length, 2); assert.equal(h.calls[1].dataEntrada, '2026-02-10')
  assert.notEqual(h.calls[0].matriculaId, h.calls[1].matriculaId)
  h.unmount()
})

test('a previously selected athlete who left the arena cannot be linked after reconciliation', async () => {
  const h = studentFixture(); h.select('Alice')
  h.props.catalogo = { ...catalog(), atletas: [athlete('Bruna'), { ...athlete('Alice'), membro: false }] }
  assert.equal(h.link().props.disabled, true)
  await h.link().props.onClick(); assert.equal(h.calls.length, 0)
  h.unmount()
})
