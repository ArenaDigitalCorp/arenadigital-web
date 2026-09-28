import { z } from 'zod'

const uuidSchema = z.string().uuid()
const valorSchema = z.number().finite().min(0).max(100_000_000)

export const configurarRateioSchema = z.object({
  arenaId: uuidSchema,
  bookingId: uuidSchema,
  ativo: z.boolean(),
})

export const adicionarParticipanteRateioSchema = z
  .object({
    arenaId: uuidSchema,
    bookingId: uuidSchema,
    atletaId: uuidSchema.nullable(),
    nome: z.string().trim().max(120).nullable(),
    valor: valorSchema,
  })
  .refine((v) => v.atletaId !== null || (v.nome ?? '').length > 0, {
    message: 'Informe o nome do participante',
  })

export const atualizarValoresRateioSchema = z.object({
  arenaId: uuidSchema,
  bookingId: uuidSchema,
  valores: z
    .array(z.object({ cobrancaId: uuidSchema, valor: valorSchema }))
    .min(1)
    .max(50),
})

export const removerParticipanteRateioSchema = z.object({
  arenaId: uuidSchema,
  cobrancaId: uuidSchema,
})

export const registrarPagamentoRateioSchema = z.object({
  arenaId: uuidSchema,
  cobrancaId: uuidSchema,
  operationId: uuidSchema,
  valor: valorSchema.refine((v) => v > 0, { message: 'Informe um valor a pagar' }),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  modoPagamentoId: uuidSchema.nullable(),
  observacao: z.string().trim().max(400).nullable(),
})

export type AdicionarParticipanteRateioInput = z.infer<typeof adicionarParticipanteRateioSchema>
export type AtualizarValoresRateioInput = z.infer<typeof atualizarValoresRateioSchema>
export type RegistrarPagamentoRateioInput = z.infer<typeof registrarPagamentoRateioSchema>
