/** 0 = domingo … 6 = sábado (mesma convenção de `planos_mensalista.dia_semana`). */
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface Esporte {
  id: string
  nome: string
  /** `sports.sigla`: prefixo do código das turmas. Nulo = o banco deriva do nome. */
  sigla: string | null
  ativo: boolean
  niveis: { id: string; nome: string; ativo: boolean }[]
}

export interface Espaco {
  id: string
  nome: string
  ativo: boolean
  /** Tabela com que a recorrência criada pela turma é cotada: Professor, senão Padrão. */
  tabelaTurma: { id: string; tipo: 'Professor' | 'Padrão' } | null
}

export interface BlocoHorario {
  id: string
  espacoId: string
  diaSemana: DiaSemana
  inicio: string
  fim: string
}

export interface TurmaNoBloco {
  turmaId: string
  codigo: string
  inicio: string
  fim: string
}

export interface RecorrenciaExistente {
  id: string
  responsavelId: string
  responsavelNome: string
  /** Tipo da tabela de preço do plano: só `professor` identifica plano de professor. */
  perfil: 'professor' | 'mensalista'
  dataInicio: string
  /** Preenchido quando a recorrência nasceu do cadastro de uma turma. */
  criadaPelaTurmaId: string | null
  /** 1º dia do mês a partir do qual a recorrência acaba (`planos_mensalista.data_encerramento_prevista`). */
  encerraAPartirDe: string | null
  valorMensal: number | null
  blocos: BlocoHorario[]
  /** Trechos usados por turmas ativas, por bloco (vem de `list_turma_recorrencias`). */
  usoPorBloco: Record<string, TurmaNoBloco[]>
}

export interface Atleta {
  id: string
  nome: string
  cpf: string | null
  telefone: string | null
  email: string | null
  /** esporteId → nome do nível no perfil do atleta. */
  niveis: Record<string, string>
  /** Ainda vinculado à arena (quem saiu continua aparecendo no histórico). */
  membro: boolean
}

export interface Professor extends Atleta {
  /** Quando o gestor definiu o perfil Professor; nulo quando o perfil é só sugerido. */
  professorDesde: string | null
}

/** Parte de um bloco da recorrência usada pela turma (pode ser o bloco inteiro). */
export interface TrechoHorario {
  blocoId: string
  inicio: string
  fim: string
  /** O bloco da recorrência, para dia e espaço — mesmo com a recorrência já encerrada. */
  bloco: BlocoHorario
}

export interface RecorrenciaTurma {
  recorrenciaId: string
  trechos: TrechoHorario[]
  criadaPelaTurma: boolean
}

export interface Matricula {
  id: string
  atletaId: string
  entrada: string
  saida: string | null
  motivoSaida: string | null
}

export type StatusTurma = 'ativa' | 'encerrada'

export interface Turma {
  id: string
  /** Gerado pelo banco (SIGLA-000) e imutável: o atleta vai buscar a turma por ele no app. */
  codigo: string
  codigoPrefixo: string
  codigoSequencia: number
  professorId: string
  esporteId: string
  nivelIds: string[]
  criadaEm: string
  /** Nulo = sem limite de alunos. */
  vagas: number | null
  status: StatusTurma
  encerradaEm: string | null
  motivoEncerramento: string | null
  recorrencia: RecorrenciaTurma
  matriculas: Matricula[]
}

export interface TurmasCatalogo {
  esportes: Esporte[]
  espacos: Espaco[]
  professores: Professor[]
  atletas: Atleta[]
  recorrencias: RecorrenciaExistente[]
}

export interface TurmasPageData {
  catalogo: TurmasCatalogo
  turmas: Turma[]
}
