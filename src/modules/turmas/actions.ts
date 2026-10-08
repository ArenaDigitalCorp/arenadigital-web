'use server'

/* eslint-disable @typescript-eslint/no-explicit-any -- tabelas e RPCs de turma ainda fora de supabase.types.ts */

import { revalidatePath } from 'next/cache'
import { ZodError } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { assertArenaBackofficeAccess, requireAuthenticatedDbUser } from '@/lib/server-auth'
import { fetchAllSupabaseRows } from '@/lib/supabase-pagination'
import { traduzirErroTurma, type ErroRpc } from './erros'
import {
  criarTurmaSchema,
  desvincularAlunoSchema,
  editarTurmaSchema,
  encerrarTurmaSchema,
  paramsHorarios,
  vincularAlunoSchema,
} from './schemas'
import type {
  Atleta,
  DiaSemana,
  Espaco,
  Esporte,
  Professor,
  RecorrenciaExistente,
  Turma,
  TurmasPageData,
} from './types'

type LooseClient = {
  from: (table: string) => any
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: any; error: ErroRpc | null }>
}

function loose(): LooseClient {
  return getSupabaseAdmin() as unknown as LooseClient
}

export type ResultadoTurma<T> =
  | { success: true; data: T }
  | { success: false; error: string; sobreposicao?: string[] }

const hhmm = (valor: string) => valor.slice(0, 5)

/** timestamptz → dia (YYYY-MM-DD) em Brasília. */
function diaEmBrasilia(instante: string | null): string | null {
  return instante ? new Date(instante).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }) : null
}

function falha<T>(err: unknown, padrao: string): ResultadoTurma<T> {
  if (err instanceof ZodError) return { success: false, error: err.issues[0]?.message ?? padrao }
  return { success: false, error: err instanceof Error ? err.message : padrao }
}

function falhaRpc<T>(erro: ErroRpc): ResultadoTurma<T> {
  const traduzido = traduzirErroTurma(erro)
  return traduzido.tipo === 'sobreposicao'
    ? { success: false, error: traduzido.mensagem, sobreposicao: traduzido.turmas }
    : { success: false, error: traduzido.mensagem }
}

// ── Leitura ──────────────────────────────────────────────────────────────

interface AtletaRow {
  id: string
  nome_perfil: string
  cpf: string | null
  telefone: string | null
  users: { email: string | null } | { email: string | null }[] | null
  arenas_atleta?: { perfil_definido_em: string | null }[]
  atleta_esportes: {
    id_esporte: string
    nivel: { nivel: string } | { nivel: string }[] | null
  }[]
}

const ATLETA_SELECT =
  'id, nome_perfil, cpf, telefone, users:id_users(email), atleta_esportes(id_esporte, nivel:id_nivel_habilidade_esporte(nivel))'

function umOuNulo<T>(valor: T | T[] | null | undefined): T | null {
  return Array.isArray(valor) ? (valor[0] ?? null) : (valor ?? null)
}

function paraAtleta(row: AtletaRow, membro: boolean): Atleta {
  const niveis: Record<string, string> = {}
  for (const esporte of row.atleta_esportes ?? []) {
    const nivel = umOuNulo(esporte.nivel)?.nivel
    if (nivel) niveis[esporte.id_esporte] = nivel
  }
  return {
    id: row.id,
    nome: row.nome_perfil,
    cpf: row.cpf,
    telefone: row.telefone,
    email: umOuNulo(row.users)?.email ?? null,
    niveis,
    membro,
  }
}

export async function getTurmasPageDataAction(arenaId: string): Promise<ResultadoTurma<TurmasPageData>> {
  try {
    await assertArenaBackofficeAccess(arenaId)
    const db = loose()

    const [esportesRes, espacosRes, atletasRes, perfisRes, recorrenciasRes, turmasRes, matriculasRes] =
      await Promise.all([
        db
          .from('sports')
          .select('id, name, sigla, is_active, niveis:nivel_habilidade_esporte(id, nivel, is_active, sort_order)')
          .eq('category', 'sport')
          .order('name'),
        db
          .from('courts')
          .select('id, name, status, court_price_tables(id, tipo, ativo, is_default, ordem)')
          .eq('arena_id', arenaId)
          .order('name'),
        fetchAllSupabaseRows<AtletaRow>(
          db
            .from('atleta')
            .select(`${ATLETA_SELECT}, arenas_atleta!inner(id_arena, perfil_definido_em)`)
            .eq('arenas_atleta.id_arena', arenaId)
            .order('nome_perfil')
            .order('id'),
        ),
        db.rpc('list_atleta_perfis', { p_arena_id: arenaId }),
        db.rpc('list_turma_recorrencias', { p_arena_id: arenaId }),
        fetchAllSupabaseRows<any>(
          db
            .from('turmas')
            .select(
              `id, codigo, codigo_prefixo, codigo_sequencia, professor_atleta_id, esporte_id,
               plano_mensalista_id, recorrencia_criada_pela_turma, data_criacao, vagas, status,
               encerrada_em, motivo_encerramento,
               turma_niveis(nivel_id),
               turma_horarios(bloco_id, horario_inicio, horario_fim,
                 bloco:planos_mensalista_blocos(id, court_id, dia_semana, horario_inicio, horario_fim))`,
            )
            .eq('arena_id', arenaId)
            .order('id'),
        ),
        fetchAllSupabaseRows<any>(
          db
            .from('turma_alunos')
            .select('id, turma_id, atleta_id, data_entrada, data_saida, motivo_saida')
            .eq('arena_id', arenaId)
            .order('data_entrada')
            .order('id'),
        ),
      ])

    for (const res of [esportesRes, espacosRes, atletasRes, perfisRes, recorrenciasRes, turmasRes, matriculasRes]) {
      if (res.error) throw new Error(res.error.message)
    }

    const esportes: Esporte[] = (esportesRes.data ?? []).map((s: any) => ({
      id: s.id,
      nome: s.name,
      sigla: s.sigla,
      ativo: s.is_active,
      niveis: [...(s.niveis ?? [])]
        .sort((a: any, b: any) => a.sort_order - b.sort_order || a.nivel.localeCompare(b.nivel, 'pt-BR'))
        .map((n: any) => ({ id: n.id, nome: n.nivel, ativo: n.is_active })),
    }))

    // Mesma escolha de private.turma_tabela_preco_professor (o banco decide ao
    // criar; aqui é só para cotar a prévia): Professor ativa, senão Padrão/default.
    const espacos: Espaco[] = (espacosRes.data ?? []).map((c: any) => {
      const tabelas = (c.court_price_tables ?? []).filter((t: any) => t.ativo)
      const professor = tabelas.find((t: any) => t.tipo === 'professor')
      const padrao =
        tabelas.find((t: any) => t.tipo === 'padrao') ?? tabelas.find((t: any) => t.is_default)
      return {
        id: c.id,
        nome: c.name,
        ativo: c.status === 'ativo',
        tabelaTurma: professor
          ? { id: professor.id, tipo: 'Professor' as const }
          : padrao
            ? { id: padrao.id, tipo: 'Padrão' as const }
            : null,
      }
    })

    const perfis = new Map<string, string>(
      ((perfisRes.data ?? []) as { atleta_id: string; perfil_efetivo: string }[]).map((p) => [
        p.atleta_id,
        p.perfil_efetivo,
      ]),
    )

    const atletaRows = atletasRes.data ?? []
    const atletas: Atleta[] = atletaRows.map((row) => paraAtleta(row, true))
    const professores: Professor[] = atletaRows
      .filter((row) => perfis.get(row.id) === 'professor')
      .map((row) => ({
        ...paraAtleta(row, true),
        professorDesde: diaEmBrasilia(row.arenas_atleta?.[0]?.perfil_definido_em ?? null),
      }))

    const matriculasPorTurma = new Map<string, Turma['matriculas']>()
    for (const m of matriculasRes.data ?? []) {
      const lista = matriculasPorTurma.get(m.turma_id) ?? []
      lista.push({
        id: m.id,
        atletaId: m.atleta_id,
        entrada: m.data_entrada,
        saida: m.data_saida,
        motivoSaida: m.motivo_saida,
      })
      matriculasPorTurma.set(m.turma_id, lista)
    }

    const turmas: Turma[] = (turmasRes.data ?? []).map((t: any) => ({
      id: t.id,
      codigo: t.codigo,
      codigoPrefixo: t.codigo_prefixo,
      codigoSequencia: t.codigo_sequencia,
      professorId: t.professor_atleta_id,
      esporteId: t.esporte_id,
      nivelIds: (t.turma_niveis ?? []).map((n: any) => n.nivel_id),
      criadaEm: t.data_criacao,
      vagas: t.vagas,
      status: t.status,
      encerradaEm: t.encerrada_em,
      motivoEncerramento: t.motivo_encerramento,
      recorrencia: {
        recorrenciaId: t.plano_mensalista_id,
        criadaPelaTurma: t.recorrencia_criada_pela_turma,
        trechos: (t.turma_horarios ?? []).map((h: any) => {
          const bloco = umOuNulo<any>(h.bloco)
          return {
            blocoId: h.bloco_id,
            inicio: hhmm(h.horario_inicio),
            fim: hhmm(h.horario_fim),
            bloco: {
              id: h.bloco_id,
              espacoId: bloco?.court_id ?? '',
              diaSemana: (bloco?.dia_semana ?? 0) as DiaSemana,
              inicio: hhmm(bloco?.horario_inicio ?? h.horario_inicio),
              fim: hhmm(bloco?.horario_fim ?? h.horario_fim),
            },
          }
        }),
      },
      matriculas: matriculasPorTurma.get(t.id) ?? [],
    }))

    // Quem já saiu da arena continua no histórico (alunos e professores das turmas).
    const conhecidos = new Set(atletas.map((a) => a.id))
    const faltando = [
      ...new Set([
        ...turmas.map((t) => t.professorId),
        ...turmas.flatMap((t) => t.matriculas.map((m) => m.atletaId)),
      ]),
    ].filter((id) => !conhecidos.has(id))
    for (let i = 0; i < faltando.length; i += 200) {
      const { data, error } = await db.from('atleta').select(ATLETA_SELECT).in('id', faltando.slice(i, i + 200))
      if (error) throw new Error(error.message)
      atletas.push(...((data ?? []) as AtletaRow[]).map((row) => paraAtleta(row, false)))
    }

    const recorrencias: RecorrenciaExistente[] = ((recorrenciasRes.data ?? []) as any[]).map((r) => ({
      id: r.plano_id,
      responsavelId: r.responsavel_atleta_id,
      responsavelNome: r.responsavel_nome,
      perfil: r.tabela_tipo === 'professor' ? 'professor' : 'mensalista',
      dataInicio: r.data_inicio,
      criadaPelaTurmaId:
        turmas.find((t) => t.recorrencia.recorrenciaId === r.plano_id && t.recorrencia.criadaPelaTurma)?.id ?? null,
      encerraAPartirDe: r.data_encerramento_prevista,
      valorMensal: r.valor_mensal === null ? null : Number(r.valor_mensal),
      blocos: (r.blocos ?? []).map((b: any) => ({
        id: b.bloco_id,
        espacoId: b.court_id,
        diaSemana: b.dia_semana as DiaSemana,
        inicio: b.horario_inicio,
        fim: b.horario_fim,
      })),
      usoPorBloco: Object.fromEntries(
        (r.blocos ?? []).map((b: any) => [
          b.bloco_id,
          (b.turmas ?? []).map((u: any) => ({
            turmaId: u.turma_id,
            codigo: u.codigo,
            inicio: u.horario_inicio,
            fim: u.horario_fim,
          })),
        ]),
      ),
    }))

    return { success: true, data: { catalogo: { esportes, espacos, professores, atletas, recorrencias }, turmas } }
  } catch (err) {
    return falha(err, 'Erro ao carregar as turmas')
  }
}

// ── Escrita ──────────────────────────────────────────────────────────────

function revalidar(arenaId: string) {
  revalidatePath(`/dashboard/turmas/${arenaId}`)
}

export async function criarTurmaAction(
  input: unknown,
): Promise<ResultadoTurma<{ turmaId: string; codigo: string; recorrenciaCriada: boolean }>> {
  try {
    const parsed = criarTurmaSchema.parse(input)
    await assertArenaBackofficeAccess(parsed.arenaId)
    const { dbUserId } = await requireAuthenticatedDbUser()

    const { data, error } = await loose().rpc('create_turma_atomic', {
      p_turma_id: parsed.turmaId,
      p_arena_id: parsed.arenaId,
      p_professor_atleta_id: parsed.professorId,
      p_esporte_id: parsed.esporteId,
      p_nivel_ids: parsed.nivelIds,
      p_data_criacao: parsed.dataCriacao,
      p_vagas: parsed.vagas,
      ...paramsHorarios(parsed.horarios),
      p_alunos: parsed.alunos,
      p_confirmar_sobreposicao: parsed.confirmarSobreposicao,
      p_registered_by: dbUserId,
    })
    if (error) return falhaRpc(error)

    revalidar(parsed.arenaId)
    return {
      success: true,
      data: { turmaId: data.turma_id, codigo: data.codigo, recorrenciaCriada: Boolean(data.recorrencia_criada) },
    }
  } catch (err) {
    return falha(err, 'Erro ao criar a turma')
  }
}

export async function editarTurmaAction(
  input: unknown,
): Promise<ResultadoTurma<{ codigo: string; recorrenciaCriada: boolean }>> {
  try {
    const parsed = editarTurmaSchema.parse(input)
    await assertArenaBackofficeAccess(parsed.arenaId)
    const { dbUserId } = await requireAuthenticatedDbUser()

    const { data, error } = await loose().rpc('update_turma_atomic', {
      p_arena_id: parsed.arenaId,
      p_turma_id: parsed.turmaId,
      p_professor_atleta_id: parsed.professorId,
      p_nivel_ids: parsed.nivelIds,
      p_data_criacao: parsed.dataCriacao,
      p_vagas: parsed.vagas,
      ...paramsHorarios(parsed.horarios),
      p_confirmar_sobreposicao: parsed.confirmarSobreposicao,
      p_registered_by: dbUserId,
    })
    if (error) return falhaRpc(error)

    revalidar(parsed.arenaId)
    return { success: true, data: { codigo: data.codigo, recorrenciaCriada: Boolean(data.recorrencia_criada) } }
  } catch (err) {
    return falha(err, 'Erro ao salvar a turma')
  }
}

export async function encerrarTurmaAction(input: unknown): Promise<
  ResultadoTurma<{
    alunosDesvinculados: number
    recorrenciaAPartirDe: string | null
    recorrenciaCanceladaAgora: boolean
    reservasCanceladas: number
  }>
> {
  try {
    const parsed = encerrarTurmaSchema.parse(input)
    await assertArenaBackofficeAccess(parsed.arenaId)
    const { dbUserId } = await requireAuthenticatedDbUser()

    const { data, error } = await loose().rpc('encerrar_turma_atomic', {
      p_arena_id: parsed.arenaId,
      p_turma_id: parsed.turmaId,
      p_data_encerramento: parsed.data,
      p_motivo: parsed.motivo,
      p_recorrencia_a_partir_de: parsed.recorrencia?.modo === 'mes' ? parsed.recorrencia.aPartirDe : null,
      p_registered_by: dbUserId,
      // Só vai quando usado: assim a chamada continua válida para a assinatura
      // anterior da RPC (antes da migração 20261008120000).
      ...(parsed.recorrencia?.modo === 'agora' ? { p_encerrar_recorrencia_agora: true } : {}),
    })
    if (error) return falhaRpc(error)

    revalidar(parsed.arenaId)
    return {
      success: true,
      data: {
        alunosDesvinculados: Number(data.alunos_desvinculados ?? 0),
        recorrenciaAPartirDe: data.recorrencia_encerra_a_partir_de ?? null,
        recorrenciaCanceladaAgora: Boolean(data.recorrencia_cancelada_agora),
        reservasCanceladas: Number(data.reservas_canceladas ?? 0),
      },
    }
  } catch (err) {
    return falha(err, 'Erro ao encerrar a turma')
  }
}

export async function vincularAlunoAction(input: unknown): Promise<ResultadoTurma<{ matriculaId: string }>> {
  try {
    const parsed = vincularAlunoSchema.parse(input)
    await assertArenaBackofficeAccess(parsed.arenaId)
    const { dbUserId } = await requireAuthenticatedDbUser()

    const { data, error } = await loose().rpc('vincular_turma_aluno_atomic', {
      p_matricula_id: parsed.matriculaId,
      p_arena_id: parsed.arenaId,
      p_turma_id: parsed.turmaId,
      p_atleta_id: parsed.atletaId,
      p_data_entrada: parsed.dataEntrada,
      p_registered_by: dbUserId,
    })
    if (error) return falhaRpc(error)

    revalidar(parsed.arenaId)
    return { success: true, data: { matriculaId: data.matricula_id } }
  } catch (err) {
    return falha(err, 'Erro ao vincular o atleta')
  }
}

export async function desvincularAlunoAction(input: unknown): Promise<ResultadoTurma<{ dataSaida: string }>> {
  try {
    const parsed = desvincularAlunoSchema.parse(input)
    await assertArenaBackofficeAccess(parsed.arenaId)
    const { dbUserId } = await requireAuthenticatedDbUser()

    const { data, error } = await loose().rpc('desvincular_turma_aluno_atomic', {
      p_arena_id: parsed.arenaId,
      p_matricula_id: parsed.matriculaId,
      p_data_saida: parsed.dataSaida,
      p_motivo: parsed.motivo,
      p_registered_by: dbUserId,
    })
    if (error) return falhaRpc(error)

    revalidar(parsed.arenaId)
    return { success: true, data: { dataSaida: data.data_saida } }
  } catch (err) {
    return falha(err, 'Erro ao desvincular o atleta')
  }
}
