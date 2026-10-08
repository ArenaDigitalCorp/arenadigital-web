import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

import { corrigirAcentos, traduzirErroTurma } from '../src/modules/turmas/erros.ts'
import {
  criarTurmaSchema,
  encerrarTurmaSchema,
  paramsHorarios,
  vincularAlunoSchema,
} from '../src/modules/turmas/schemas.ts'
import {
  blocosDaTurma,
  formatarCodigo,
  mesesDeEncerramento,
  primeiraFaixaLivre,
  proximaAula,
  proximoCodigo,
  resumosDeAtletas,
  usaTrechoParcial,
} from '../src/modules/turmas/lib.ts'

const ID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const bloco = { id: ID(50), espacoId: ID(20), diaSemana: 2, inicio: '19:00', fim: '21:00' }
const turma = (over = {}) => ({
  id: ID(100),
  codigo: 'BT-001',
  codigoPrefixo: 'BT',
  codigoSequencia: 1,
  professorId: ID(30),
  esporteId: ID(10),
  nivelIds: [ID(11)],
  criadaEm: '2046-02-01',
  vagas: null,
  status: 'ativa',
  encerradaEm: null,
  motivoEncerramento: null,
  recorrencia: {
    recorrenciaId: ID(40),
    criadaPelaTurma: false,
    trechos: [{ blocoId: bloco.id, inicio: '19:00', fim: '20:00', bloco }],
  },
  matriculas: [],
  ...over,
})

test('database errors reach the screen with correct Portuguese spelling', () => {
  assert.equal(
    traduzirErroTurma({ message: 'A recorrencia tambem e usada por outra turma ativa', code: '55000' }).mensagem,
    'A recorrência também é usada por outra turma ativa',
  )
  assert.equal(
    traduzirErroTurma({ message: 'Nivel invalido para o esporte da turma' }).mensagem,
    'Nível inválido para o esporte da turma',
  )
  assert.equal(traduzirErroTurma({ message: 'Turma lotada (2 de 2 vagas)' }).mensagem, 'Turma lotada (2 de 2 vagas)')
  assert.equal(
    traduzirErroTurma({ message: 'A nova entrada nao pode ser anterior a ultima saida do atleta (01/10/2026)' }).mensagem,
    'A nova entrada não pode ser anterior à última saída do atleta (01/10/2026)',
  )
  assert.equal(
    corrigirAcentos('A data de criacao nao pode ser posterior a entrada de um aluno'),
    'A data de criação não pode ser posterior à entrada de um aluno',
  )
  assert.equal(
    corrigirAcentos('Para encerrar a recorrencia a partir de hoje, a turma precisa encerrar ate hoje'),
    'Para encerrar a recorrência a partir de hoje, a turma precisa encerrar até hoje',
  )
  assert.equal(corrigirAcentos('constructor toString'), 'constructor toString')
  assert.equal(traduzirErroTurma(null).tipo, 'erro')
})

test('unconfirmed overlap (23P01) becomes a confirmation request with the turma codes', () => {
  const r = traduzirErroTurma({ message: 'Horario sobreposto com a turma BT-001, BT-002', code: '23P01', details: 'BT-001,BT-002' })
  assert.deepEqual(r, { tipo: 'sobreposicao', turmas: ['BT-001', 'BT-002'], mensagem: 'Horário sobreposto com BT-001, BT-002.' })
})

test('create input: existing recurrence trechos or a new whole-hour recurrence', () => {
  const base = {
    arenaId: ID(1),
    turmaId: ID(2),
    professorId: ID(3),
    esporteId: ID(4),
    nivelIds: [ID(5)],
    dataCriacao: '2046-02-01',
    vagas: null,
    alunos: [],
    confirmarSobreposicao: false,
  }
  const existente = criarTurmaSchema.parse({
    ...base,
    horarios: { tipo: 'existente', planoId: ID(6), trechos: [{ blocoId: ID(7), inicio: '19:30', fim: '20:30' }] },
  })
  assert.deepEqual(paramsHorarios(existente.horarios), {
    p_plano_id: ID(6),
    p_trechos: [{ bloco_id: ID(7), horario_inicio: '19:30', horario_fim: '20:30' }],
    p_nova_recorrencia: null,
  })

  const nova = criarTurmaSchema.parse({
    ...base,
    horarios: {
      tipo: 'nova',
      blocos: [{ espacoId: ID(8), diaSemana: 4, inicio: '07:00', fim: '08:00' }],
      dataInicio: '2046-05-10',
      valorMensal: 360,
    },
  })
  assert.deepEqual(paramsHorarios(nova.horarios).p_nova_recorrencia, {
    blocos: [{ court_id: ID(8), dia_semana: 4, horario_inicio: '07:00', horario_fim: '08:00' }],
    data_inicio: '2046-05-10',
    valor_mensal: 360,
  })

  // Novo horário em hora cheia, como a grade de Mensalistas e o RPC de blocos.
  assert.throws(() =>
    criarTurmaSchema.parse({
      ...base,
      horarios: { tipo: 'nova', blocos: [{ espacoId: ID(8), diaSemana: 4, inicio: '07:30', fim: '08:30' }], dataInicio: '2046-05-10', valorMensal: 360 },
    }),
  )
  assert.throws(() => criarTurmaSchema.parse({ ...base, horarios: { tipo: 'existente', planoId: ID(6), trechos: [] } }))
  assert.throws(() => criarTurmaSchema.parse({ ...base, vagas: 0, horarios: existente.horarios }))
})

test('close and link inputs normalize optional text and require ids', () => {
  const base = { arenaId: ID(1), turmaId: ID(2), data: '2046-04-01', motivo: '  ' }
  assert.equal(encerrarTurmaSchema.parse({ ...base, recorrencia: null }).motivo, null)
  assert.deepEqual(encerrarTurmaSchema.parse({ ...base, recorrencia: { modo: 'agora' } }).recorrencia, { modo: 'agora' })
  assert.deepEqual(
    encerrarTurmaSchema.parse({ ...base, recorrencia: { modo: 'mes', aPartirDe: '2046-05-01' } }).recorrencia,
    { modo: 'mes', aPartirDe: '2046-05-01' },
  )
  assert.throws(() => encerrarTurmaSchema.parse({ ...base, recorrencia: { modo: 'mes' } }))
  assert.throws(() => vincularAlunoSchema.parse({ arenaId: ID(1), turmaId: ID(2), atletaId: ID(3), dataEntrada: '2046-02-01' }))
})

test('code preview follows the database sequence and never reuses ended codes', () => {
  const esporte = { id: ID(10), nome: 'Beach Tennis', sigla: 'BT', ativo: true, niveis: [] }
  const turmas = [
    turma(),
    turma({ id: ID(101), codigo: 'BT-004', codigoSequencia: 4, status: 'encerrada', encerradaEm: '2046-03-01' }),
    turma({ id: ID(102), codigo: 'PIL-009', codigoPrefixo: 'PIL', codigoSequencia: 9 }),
  ]
  assert.equal(proximoCodigo(esporte, turmas), 'BT-005')
  assert.equal(proximoCodigo({ ...esporte, sigla: null }, turmas), null)
  assert.equal(formatarCodigo('BT', 1000), 'BT-1000')
})

test('turma schedule comes from the stored block, partial trechos included', () => {
  assert.deepEqual(blocosDaTurma(turma()), [{ ...bloco, inicio: '19:00', fim: '20:00' }])
  assert.equal(usaTrechoParcial(turma()), true)
  assert.deepEqual(primeiraFaixaLivre(bloco, [{ inicio: '19:00', fim: '20:00' }]), { inicio: '20:00', fim: '21:00' })
  assert.equal(primeiraFaixaLivre(bloco, [{ inicio: '19:00', fim: '21:00' }]), null)
  assert.deepEqual(mesesDeEncerramento('2046-05-20', 2), ['2046-06-01', '2046-07-01'])
  assert.deepEqual(mesesDeEncerramento('2046-06-01', 1), ['2046-06-01'])
})

test('next class for "from today": the nearest block occurrence that has not started', () => {
  const blocos = [bloco, { ...bloco, id: ID(51), diaSemana: 4 }] // terça e quinta, 19h
  // Terça, 06/10/2026 às 18h → hoje mesmo, 19h.
  assert.deepEqual(proximaAula(blocos, new Date(2026, 9, 6, 18, 0)), new Date(2026, 9, 6, 19, 0))
  // Terça às 20h (a aula de hoje já começou) → quinta, 08/10, 19h.
  assert.deepEqual(proximaAula(blocos, new Date(2026, 9, 6, 20, 0)), new Date(2026, 9, 8, 19, 0))
  assert.equal(proximaAula([], new Date(2026, 9, 6)), null)
})

test('athletes tab: in a turma vs former student and level outside the turma', () => {
  const catalogo = {
    esportes: [{ id: ID(10), nome: 'Beach Tennis', sigla: 'BT', ativo: true, niveis: [{ id: ID(11), nome: 'D', ativo: true }] }],
    espacos: [],
    professores: [],
    recorrencias: [],
    atletas: [
      { id: ID(60), nome: 'Ana', cpf: null, telefone: null, email: null, niveis: { [ID(10)]: 'C' }, membro: true },
      { id: ID(61), nome: 'Bia', cpf: null, telefone: null, email: null, niveis: {}, membro: true },
    ],
  }
  const turmas = [
    turma({
      matriculas: [
        { id: ID(200), atletaId: ID(60), entrada: '2046-02-01', saida: null, motivoSaida: null },
        { id: ID(201), atletaId: ID(61), entrada: '2046-02-01', saida: '2046-03-01', motivoSaida: 'Mudou de horário' },
      ],
    }),
  ]
  const [ana, bia] = resumosDeAtletas(turmas, catalogo).sort((a, b) => a.atleta.nome.localeCompare(b.atleta.nome))
  assert.equal(ana.situacao, 'em-turma')
  assert.deepEqual(ana.nivelForaEm, ['BT-001'])
  assert.equal(ana.minutosSemana, 60)
  assert.equal(bia.situacao, 'ex-aluno')
  assert.deepEqual(bia.ultimaMovimentacao, { data: '2046-03-01', tipo: 'saida', codigo: 'BT-001' })
})

test('every turma action checks backoffice access and writes only through the turma RPCs', async () => {
  const actions = await readFile(new URL('../src/modules/turmas/actions.ts', import.meta.url), 'utf8')
  const exportadas = [...actions.matchAll(/export async function (\w+)\(/g)].map((m) => m[1])
  assert.deepEqual(exportadas, [
    'getTurmasPageDataAction',
    'criarTurmaAction',
    'editarTurmaAction',
    'encerrarTurmaAction',
    'vincularAlunoAction',
    'desvincularAlunoAction',
  ])
  const blocos = actions.split('export async function ').slice(1)
  for (const bloco of blocos) assert.match(bloco, /await assertArenaBackofficeAccess\(/)
  for (const bloco of blocos.slice(1)) assert.match(bloco, /requireAuthenticatedDbUser\(\)/)
  for (const rpc of [
    'create_turma_atomic',
    'update_turma_atomic',
    'encerrar_turma_atomic',
    'vincular_turma_aluno_atomic',
    'desvincular_turma_aluno_atomic',
    'list_turma_recorrencias',
    'list_atleta_perfis',
  ]) {
    assert.match(actions, new RegExp(`rpc\\('${rpc}'`))
  }
  assert.doesNotMatch(actions, /\.(insert|update|upsert|delete)\(/)
})

test('the Turmas screen has no mock data left', async () => {
  const pasta = new URL('../src/modules/turmas/', import.meta.url)
  const arquivos = await readdir(pasta, { recursive: true })
  assert.ok(!arquivos.some((nome) => nome.includes('mock')))
  for (const nome of arquivos.filter((n) => n.endsWith('.tsx') || n.endsWith('.ts'))) {
    const fonte = await readFile(new URL(nome, pasta), 'utf8')
    assert.doesNotMatch(fonte, /mock-data|dados fictícios|Protótipo/, nome)
  }
})
