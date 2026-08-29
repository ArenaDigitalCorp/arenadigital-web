import { z } from 'zod'

export const uuidSchema = z.string().uuid()
export const competenciaSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Competência inválida')

export const rateioParticipanteSchema = z.object({
  atleta_id: uuidSchema.nullable(),
  nome: z.string().trim().min(1).max(160),
  ativo: z.boolean(),
  valor: z.number().finite().min(0).max(100_000_000),
})

export const configureRateioSchema = z.object({
  arenaId: uuidSchema,
  mensalidadeId: uuidSchema,
  rateio: z.boolean(),
  participantes: z.array(rateioParticipanteSchema).max(50),
})

export const registrarPagamentoSchema = z
  .object({
    arenaId: uuidSchema,
    cobrancaId: uuidSchema,
    operationId: uuidSchema,
    valor: z.number().finite().min(0).max(100_000_000),
    creditoAplicado: z.number().finite().min(0).max(100_000_000),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    modoPagamentoId: uuidSchema.nullable(),
    observacao: z.string().trim().max(400).nullable(),
  })
  .refine((v) => v.valor + v.creditoAplicado > 0, {
    message: 'Informe um valor a pagar',
    path: ['valor'],
  })

export const lancarCreditoSchema = z.object({
  arenaId: uuidSchema,
  atletaId: uuidSchema,
  operationId: uuidSchema,
  valor: z.number().finite().refine((v) => v !== 0, 'Informe um valor de crédito'),
  descricao: z.string().trim().max(400).nullable(),
})

export const retirarCreditoSchema = z.object({
  arenaId: uuidSchema,
  atletaId: uuidSchema,
  operationId: uuidSchema,
  valor: z.number().finite().positive('Informe um valor de retirada').max(100_000_000),
  descricao: z.string().trim().max(400).nullable(),
})

export const setEncerramentoSchema = z.object({
  arenaId: uuidSchema,
  planoId: uuidSchema,
  dataPrevista: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  observacao: z.string().trim().max(400).nullable(),
})
