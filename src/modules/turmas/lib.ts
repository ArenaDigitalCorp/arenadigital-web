import { addMonths, differenceInCalendarDays, format, parseISO, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Bloco } from '@/modules/bookings/lib/mensalista-blocos'
import type {
  Atleta,
  BlocoHorario,
  DiaSemana,
  Esporte,
  Matricula,
  Professor,
  RecorrenciaExistente,
  Turma,
  TurmasCatalogo,
} from './types'

export const DIA_CURTO: Record<DiaSemana, string> = {
  0: 'Dom',
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sáb',
}

export const DIA_LONGO: Record<DiaSemana, string> = {
  0: 'Domingo',
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
}

/** Segunda primeiro: é como a arena lê a semana. */
export const DIAS_ORDEM: DiaSemana[] = [1, 2, 3, 4, 5, 6, 0]

export function hojeISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function formatData(iso: string | null): string {
  return iso ? format(parseISO(iso), 'dd/MM/yyyy') : '—'
}

export function minutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function hhmm(totalMinutos: number): string {
  return `${String(Math.floor(totalMinutos / 60)).padStart(2, '0')}:${String(totalMinutos % 60).padStart(2, '0')}`
}

export function duracaoMinutos(faixa: { inicio: string; fim: string }): number {
  return Math.max(0, minutos(faixa.fim) - minutos(faixa.inicio))
}

export function formatHoras(totalMinutos: number): string {
  const h = Math.floor(totalMinutos / 60)
  const m = totalMinutos % 60
  if (h === 0) return `${m}min`
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

export function faixasSobrepoem(a: { inicio: string; fim: string }, b: { inicio: string; fim: string }): boolean {
  return a.inicio < b.fim && b.inicio < a.fim
}

/** Ordem cronológica na semana (segunda → domingo), depois pelo horário. */
export function chaveBloco(bloco: Pick<BlocoHorario, 'diaSemana' | 'inicio'>): number {
  return DIAS_ORDEM.indexOf(bloco.diaSemana) * 10_000 + minutos(bloco.inicio)
}

export function ordenarBlocos<T extends Pick<BlocoHorario, 'diaSemana' | 'inicio'>>(blocos: T[]): T[] {
  return [...blocos].sort((a, b) => chaveBloco(a) - chaveBloco(b))
}

/**
 * "Ter, Qui · 19:00–21:00" quando todos os blocos têm a mesma faixa; senão
 * cada bloco vira "Ter 19:00–21:00".
 */
export function resumoBlocos(blocos: BlocoHorario[]): string {
  if (blocos.length === 0) return 'Sem horário'
  const ordenados = ordenarBlocos(blocos)
  const mesmaFaixa = ordenados.every((b) => b.inicio === ordenados[0].inicio && b.fim === ordenados[0].fim)
  if (mesmaFaixa) {
    const dias = [...new Set(ordenados.map((b) => DIA_CURTO[b.diaSemana]))].join(', ')
    return `${dias} · ${ordenados[0].inicio}–${ordenados[0].fim}`
  }
  return ordenados.map((b) => `${DIA_CURTO[b.diaSemana]} ${b.inicio}–${b.fim}`).join(' · ')
}

/** Os horários efetivos da turma: o dia e o espaço vêm do bloco; a faixa, do trecho. */
export function blocosDaTurma(turma: Turma): BlocoHorario[] {
  return turma.recorrencia.trechos.map((trecho) => ({ ...trecho.bloco, inicio: trecho.inicio, fim: trecho.fim }))
}

/** A turma usa só parte de algum bloco da recorrência? */
export function usaTrechoParcial(turma: Turma): boolean {
  return turma.recorrencia.trechos.some((t) => t.inicio !== t.bloco.inicio || t.fim !== t.bloco.fim)
}

/**
 * Primeira faixa livre do bloco, considerando os trechos já usados por outras
 * turmas. Sem folga de pelo menos 30 min, devolve null.
 */
export function primeiraFaixaLivre(
  bloco: BlocoHorario,
  ocupados: { inicio: string; fim: string }[],
): { inicio: string; fim: string } | null {
  let cursor = minutos(bloco.inicio)
  const fimBloco = minutos(bloco.fim)
  const ordenados = [...ocupados].sort((a, b) => minutos(a.inicio) - minutos(b.inicio))
  for (const o of ordenados) {
    if (minutos(o.inicio) - cursor >= 30) return { inicio: hhmm(cursor), fim: o.inicio }
    cursor = Math.max(cursor, minutos(o.fim))
  }
  return fimBloco - cursor >= 30 ? { inicio: hhmm(cursor), fim: hhmm(fimBloco) } : null
}

export function nomesEspacos(blocos: BlocoHorario[], catalogo: TurmasCatalogo): string {
  const ids = [...new Set(blocos.map((b) => b.espacoId))]
  return ids.map((id) => catalogo.espacos.find((e) => e.id === id)?.nome ?? '—').join(', ')
}

/** Nome de um atleta do catálogo (professor ou aluno, inclusive quem já saiu da arena). */
export function nomeAtleta(catalogo: TurmasCatalogo, atletaId: string): string {
  return (
    catalogo.professores.find((p) => p.id === atletaId)?.nome ??
    catalogo.atletas.find((a) => a.id === atletaId)?.nome ??
    '—'
  )
}

export function turmasAtivas(turmas: Turma[]): Turma[] {
  return turmas.filter((t) => t.status === 'ativa')
}

export function matriculasAtivas(turma: Turma): Matricula[] {
  return turma.matriculas.filter((m) => m.saida === null)
}

export function vagasLivres(turma: Turma): number | null {
  return turma.vagas === null ? null : Math.max(0, turma.vagas - matriculasAtivas(turma).length)
}

export function permanencia(entrada: string, saida: string | null): string {
  const dias = differenceInCalendarDays(saida ? parseISO(saida) : new Date(), parseISO(entrada))
  if (dias < 1) return 'hoje'
  if (dias < 31) return `${dias} dia${dias === 1 ? '' : 's'}`
  const meses = Math.floor(dias / 30)
  return `${meses} ${meses === 1 ? 'mês' : 'meses'}`
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
}

/**
 * O horário novo da turma vira um bloco de Mensalistas (hora cheia), para que a
 * mensalidade e o pró-rata saiam de `resumirPlano`/`fracaoPrimeiroMes` — a
 * mesma regra do cadastro de recorrência e do banco.
 */
export function paraBlocoMensalista(b: BlocoHorario): Bloco {
  const from = Number(b.inicio.slice(0, 2))
  const to = Number(b.fim.slice(0, 2))
  return {
    courtId: b.espacoId,
    diaSemana: b.diaSemana,
    from,
    to,
    hours: Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i),
  }
}

export function formatMes(iso: string): string {
  return format(parseISO(iso), "MMMM 'de' yyyy", { locale: ptBR })
}

/**
 * Meses em que a recorrência pode passar a acabar, como em Mensalistas: sempre
 * o 1º dia do mês, a partir do mês seguinte à data informada.
 */
export function mesesDeEncerramento(aPartirDe: string, quantidade = 12): string[] {
  const data = parseISO(aPartirDe)
  const primeiro = data.getDate() === 1 ? startOfMonth(data) : startOfMonth(addMonths(data, 1))
  return Array.from({ length: quantidade }, (_, i) => format(addMonths(primeiro, i), 'yyyy-MM-dd'))
}

/**
 * Próxima aula prevista da recorrência a partir de `agora` (data e hora de
 * início do bloco mais próximo). Não considera pausas nem aulas já canceladas.
 */
export function proximaAula(blocos: BlocoHorario[], agora: Date): Date | null {
  let proxima: Date | null = null
  for (const bloco of blocos) {
    const [hora, minuto] = bloco.inicio.split(':').map(Number)
    for (let dias = 0; dias <= 7; dias++) {
      const data = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + dias, hora, minuto)
      if (data.getDay() !== bloco.diaSemana || data < agora) continue
      if (!proxima || data < proxima) proxima = data
      break
    }
  }
  return proxima
}

/** Recorrência ainda disponível para turmas novas (sem encerramento marcado). */
export function recorrenciaDisponivel(r: RecorrenciaExistente): boolean {
  return r.encerraAPartirDe === null
}

/**
 * Encerrar a turma pode levar a recorrência junto só quando ela é do próprio
 * professor e nenhuma outra turma ativa depende dela.
 */
export function encerramentoDaRecorrencia(
  turma: Turma,
  turmas: Turma[],
  catalogo: TurmasCatalogo,
): { recorrencia: RecorrenciaExistente | undefined; bloqueio: string | null } {
  const recorrencia = catalogo.recorrencias.find((r) => r.id === turma.recorrencia.recorrenciaId)
  if (!recorrencia) return { recorrencia, bloqueio: 'A recorrência não está mais ativa.' }
  if (recorrencia.encerraAPartirDe)
    return { recorrencia, bloqueio: `Já tem encerramento marcado a partir de ${formatMes(recorrencia.encerraAPartirDe)}.` }
  if (recorrencia.responsavelId !== turma.professorId)
    return {
      recorrencia,
      bloqueio: `Está em nome de ${recorrencia.responsavelNome}, não do professor da turma. Se for o caso, encerre em Mensalistas.`,
    }
  const outras = turmasAtivas(turmas).filter(
    (t) => t.id !== turma.id && t.recorrencia.recorrenciaId === recorrencia.id,
  )
  if (outras.length > 0)
    return {
      recorrencia,
      bloqueio: `Também é usada por ${outras.map((t) => t.codigo).join(', ')}. Encerre essa${outras.length > 1 ? 's' : ''} turma${outras.length > 1 ? 's' : ''} antes ou ajuste em Mensalistas.`,
    }
  return { recorrencia, bloqueio: null }
}

export interface ResumoProfessor {
  professor: Professor
  esportes: string[]
  turmas: number
  turmasEncerradas: number
  /** Atletas distintos: quem está em duas turmas do mesmo professor conta uma vez. */
  alunos: number
  minutosSemana: number
}

export function resumoProfessor(professor: Professor, turmas: Turma[], catalogo: TurmasCatalogo): ResumoProfessor {
  const doProfessor = turmas.filter((t) => t.professorId === professor.id)
  const ativas = turmasAtivas(doProfessor)
  const alunos = new Set(ativas.flatMap((t) => matriculasAtivas(t).map((m) => m.atletaId)))
  const minutosSemana = ativas
    .flatMap((t) => blocosDaTurma(t))
    .reduce((soma, b) => soma + duracaoMinutos(b), 0)
  const esportes = Object.keys(professor.niveis)
    .map((id) => catalogo.esportes.find((e) => e.id === id)?.nome)
    .filter((nome): nome is string => Boolean(nome))
  return {
    professor,
    esportes,
    turmas: ativas.length,
    turmasEncerradas: doProfessor.length - ativas.length,
    alunos: alunos.size,
    minutosSemana,
  }
}

/** Nível do atleta no esporte da turma e se ele fica fora dos níveis dela. */
export function nivelNaTurma(atleta: Atleta | undefined, turma: Turma, catalogo: TurmasCatalogo) {
  const esporte = catalogo.esportes.find((e) => e.id === turma.esporteId)
  const niveisTurma = (esporte?.niveis ?? []).filter((n) => turma.nivelIds.includes(n.id)).map((n) => n.nome)
  const nivel = atleta?.niveis[turma.esporteId] ?? null
  return { nivel, niveisTurma, fora: Boolean(nivel && niveisTurma.length > 0 && !niveisTurma.includes(nivel)) }
}

export interface Periodo {
  matricula: Matricula
  turma: Turma
}

export interface ResumoAtleta {
  atleta: Atleta
  /** Todos os vínculos, de turmas ativas e encerradas. */
  periodos: Periodo[]
  ativos: Periodo[]
  esportes: { esporteId: string; nome: string; nivel: string }[]
  professores: string[]
  minutosSemana: number
  alunoDesde: string
  ultimaMovimentacao: { data: string; tipo: 'entrada' | 'saida'; codigo: string }
  /** Turmas atuais em que o nível do atleta não está entre os níveis da turma. */
  nivelForaEm: string[]
  situacao: 'em-turma' | 'ex-aluno'
}

/** Só quem tem ou já teve vínculo com alguma turma. */
export function resumosDeAtletas(turmas: Turma[], catalogo: TurmasCatalogo): ResumoAtleta[] {
  const porAtleta = new Map<string, Periodo[]>()
  for (const turma of turmas) {
    for (const matricula of turma.matriculas) {
      porAtleta.set(matricula.atletaId, [...(porAtleta.get(matricula.atletaId) ?? []), { matricula, turma }])
    }
  }

  return [...porAtleta.entries()].flatMap(([atletaId, periodos]) => {
    const atleta = catalogo.atletas.find((a) => a.id === atletaId)
    if (!atleta) return []
    const ativos = periodos.filter((p) => p.matricula.saida === null && p.turma.status === 'ativa')
    const movimentos = periodos.flatMap((p) => [
      { data: p.matricula.entrada, tipo: 'entrada' as const, codigo: p.turma.codigo },
      ...(p.matricula.saida ? [{ data: p.matricula.saida, tipo: 'saida' as const, codigo: p.turma.codigo }] : []),
    ])
    // Na mesma data, a saída vem antes da entrada: quem troca de turma "termina" entrando na nova.
    movimentos.sort((a, b) => a.data.localeCompare(b.data) || (a.tipo === 'saida' ? -1 : 1))
    const professores = [
      ...new Set(
        ativos.map((p) => nomeAtleta(catalogo, p.turma.professorId)),
      ),
    ]
    return [
      {
        atleta,
        periodos,
        ativos,
        esportes: Object.entries(atleta.niveis).map(([esporteId, nivel]) => ({
          esporteId,
          nome: catalogo.esportes.find((e) => e.id === esporteId)?.nome ?? '—',
          nivel,
        })),
        professores,
        minutosSemana: ativos
          .flatMap((p) => blocosDaTurma(p.turma))
          .reduce((soma, b) => soma + duracaoMinutos(b), 0),
        alunoDesde: movimentos[0].data,
        ultimaMovimentacao: movimentos[movimentos.length - 1],
        nivelForaEm: ativos.filter((p) => nivelNaTurma(atleta, p.turma, catalogo).fora).map((p) => p.turma.codigo),
        situacao: ativos.length > 0 ? 'em-turma' : 'ex-aluno',
      },
    ]
  })
}

export function formatarCodigo(prefixo: string, sequencia: number): string {
  return `${prefixo}-${sequencia < 1000 ? String(sequencia).padStart(3, '0') : sequencia}`
}

/**
 * Código que a próxima turma do esporte deve receber (SIGLA-000). É só uma
 * prévia: quem gera é `create_turma_atomic`, sob lock. A sequência conta as
 * turmas encerradas, como no banco — um código nunca é reaproveitado. Sem sigla
 * cadastrada o banco deriva o prefixo do nome, então não há prévia.
 */
export function proximoCodigo(esporte: Esporte, turmas: Turma[]): string | null {
  if (!esporte.sigla) return null
  const usados = turmas.filter((t) => t.codigoPrefixo === esporte.sigla).map((t) => t.codigoSequencia)
  return formatarCodigo(esporte.sigla, (usados.length ? Math.max(...usados) : 0) + 1)
}
