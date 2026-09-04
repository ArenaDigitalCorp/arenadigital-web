import * as z from 'zod'

const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido (use HH:MM).')

const money = z.coerce.number().finite().min(0).max(1_000_000)

export const priceBandSchema = z.object({
  start: hhmm,
  end: hhmm,
  price: money,
})

export const priceDaySchema = z.object({
  diaSemana: z.coerce.number().int().min(0).max(6),
  enabled: z.boolean(),
  startTime: hhmm,
  endTime: hhmm,
  slotShiftTime: hhmm.nullable().optional().default(null),
  basePrice: money,
  bands: z.array(priceBandSchema).max(24).default([]),
})

export const upsertPriceTableSchema = z.object({
  tableId: z.string().uuid().optional(),
  courtId: z.string().uuid(),
  nome: z.string().trim().min(2, 'Informe um nome.').max(60),
  tipo: z.enum(['padrao', 'mensalista', 'professor', 'custom']),
  isDefault: z.boolean().default(false),
  aplicaA: z.array(z.enum(['avulso', 'mensalista', 'professor'])).max(3).default([]),
  ativo: z.boolean().default(true),
  ordem: z.coerce.number().int().min(0).max(99).default(0),
  // Apenas os dias habilitados precisam de faixas coerentes; dias desabilitados
  // são normalizados no servidor.
  days: z.array(priceDaySchema).max(7),
})

export const createPriceTableSchema = z.object({
  courtId: z.string().uuid(),
  nome: z.string().trim().min(2).max(60),
})

export type UpsertPriceTableInput = z.infer<typeof upsertPriceTableSchema>
export type PriceDayInput = z.infer<typeof priceDaySchema>
export type PriceBandInput = z.infer<typeof priceBandSchema>
