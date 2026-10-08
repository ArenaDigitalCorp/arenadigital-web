import { z } from 'zod'

const uuid = z.string().uuid()
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido')
const horaCheia = z.string().regex(/^([01]\d|2[0-3]):00$/, 'Use hora cheia')
const motivo = z
  .string()
  .trim()
  .max(200, 'Motivo muito longo')
  .transform((v) => (v === '' ? null : v))
  .nullable()

/** Recorrência existente (trechos de blocos) ou nova recorrência do professor. */
export const horariosTurmaSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('existente'),
    planoId: uuid,
    trechos: z
      .array(z.object({ blocoId: uuid, inicio: hora, fim: hora }))
      .min(1, 'Marque pelo menos um horário da recorrência')
      .max(40),
  }),
  z.object({
    tipo: z.literal('nova'),
    blocos: z
      .array(
        z.object({
          espacoId: uuid,
          diaSemana: z.number().int().min(0).max(6),
          inicio: horaCheia,
          fim: horaCheia,
        }),
      )
      .min(1, 'Adicione pelo menos um horário')
      .max(40),
    dataInicio: data,
    valorMensal: z.number().positive('Informe o valor mensal').max(100_000_000),
  }),
])

const camposComuns = {
  arenaId: uuid,
  professorId: uuid,
  nivelIds: z.array(uuid).max(50),
  dataCriacao: data,
  vagas: z.number().int().min(1).max(1000).nullable(),
  horarios: horariosTurmaSchema,
  confirmarSobreposicao: z.boolean(),
}

export const criarTurmaSchema = z.object({
  ...camposComuns,
  /** Id gerado no cliente: é o id da operação (idempotência de create_turma_atomic). */
  turmaId: uuid,
  esporteId: uuid,
  alunos: z.array(uuid).max(1000),
})

export const editarTurmaSchema = z.object({
  ...camposComuns,
  turmaId: uuid,
})

/**
 * Encerrar a recorrência do professor junto: a partir de hoje (próximas aulas,
 * regra do "Cancelar plano") ou a partir do 1º dia de um mês ("Registrar encerramento").
 */
export const recorrenciaNoEncerramentoSchema = z.discriminatedUnion('modo', [
  z.object({ modo: z.literal('agora') }),
  z.object({ modo: z.literal('mes'), aPartirDe: data }),
])

export const encerrarTurmaSchema = z.object({
  arenaId: uuid,
  turmaId: uuid,
  data,
  motivo,
  recorrencia: recorrenciaNoEncerramentoSchema.nullable(),
})

export const vincularAlunoSchema = z.object({
  arenaId: uuid,
  turmaId: uuid,
  atletaId: uuid,
  /** Id gerado no cliente: é o id do período (idempotência). */
  matriculaId: uuid,
  dataEntrada: data,
})

export const desvincularAlunoSchema = z.object({
  arenaId: uuid,
  matriculaId: uuid,
  dataSaida: data,
  motivo,
})

export type CriarTurmaInput = z.input<typeof criarTurmaSchema>
export type EditarTurmaInput = z.input<typeof editarTurmaSchema>
export type HorariosTurmaInput = z.input<typeof horariosTurmaSchema>
export type EncerrarTurmaInput = z.input<typeof encerrarTurmaSchema>
export type VincularAlunoInput = z.input<typeof vincularAlunoSchema>
export type DesvincularAlunoInput = z.input<typeof desvincularAlunoSchema>

/** Parâmetros de horário das RPCs de turma (p_plano_id / p_trechos / p_nova_recorrencia). */
export function paramsHorarios(horarios: z.output<typeof horariosTurmaSchema>) {
  if (horarios.tipo === 'existente') {
    return {
      p_plano_id: horarios.planoId,
      p_trechos: horarios.trechos.map((t) => ({
        bloco_id: t.blocoId,
        horario_inicio: t.inicio,
        horario_fim: t.fim,
      })),
      p_nova_recorrencia: null,
    }
  }
  return {
    p_plano_id: null,
    p_trechos: null,
    p_nova_recorrencia: {
      blocos: horarios.blocos.map((b) => ({
        court_id: b.espacoId,
        dia_semana: b.diaSemana,
        horario_inicio: b.inicio,
        horario_fim: b.fim,
      })),
      data_inicio: horarios.dataInicio,
      valor_mensal: horarios.valorMensal,
    },
  }
}
