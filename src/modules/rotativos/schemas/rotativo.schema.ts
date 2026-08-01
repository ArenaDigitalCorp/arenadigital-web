import * as z from 'zod'

export const rotativoSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  id_esporte: z.string().min(1, 'Selecione o esporte'),
  court_ids: z.array(z.string().uuid()).min(1, 'Selecione ao menos uma quadra'),
  hora_inicio: z.string().min(5, 'Hora de início é obrigatória'),
  hora_fim: z.string().min(5, 'Hora de fim é obrigatória'),
  valor: z.string().min(1, 'Valor é obrigatório'),
  limitado: z.boolean(),
  limite_participantes: z.string().optional(),
})

export type RotativoFormValues = z.infer<typeof rotativoSchema>

export const createRotativoInputSchema = rotativoSchema.extend({
  arenaId: z.string().uuid(),
  valor: z.number().positive('Valor deve ser positivo'),
  limite_participantes: z.number().nullable().optional(),
})

export const updateRotativoInputSchema = createRotativoInputSchema.extend({
  rotativoId: z.string().uuid(),
})

export type CreateRotativoInput = z.infer<typeof createRotativoInputSchema>
export type UpdateRotativoInput = z.infer<typeof updateRotativoInputSchema>

export const enrollAthleteSchema = z.object({
  rotativoId: z.string().uuid(),
  arenaId: z.string().uuid(),
  athleteId: z.string().uuid(),
  paymentMethod: z.string().min(1, 'Selecione a forma de pagamento'),
  observacao: z.string().optional(),
})

export type EnrollAthleteInput = z.infer<typeof enrollAthleteSchema>

export const rotativoPacoteSchema = z.object({
  quantidade: z.number().int().positive('Quantidade inválida'),
  valor_reais: z.number().min(0, 'Valor inválido'),
})

export const savePacotesSchema = z.object({
  arenaId: z.string().uuid(),
  pacotes: z.array(rotativoPacoteSchema).min(1, 'Informe ao menos um pacote'),
})

export const launchCreditSchema = z.object({
  operationId: z.string().uuid('Operação de crédito inválida'),
  arenaId: z.string().uuid(),
  athleteId: z.string().uuid(),
  quantidade: z.number().int().positive('Informe a quantidade'),
  validityDays: z.number().int().positive('Selecione a validade'),
  modo_pagamento_id: z.string().uuid('Selecione a forma de pagamento'),
})

export type LaunchCreditInput = z.infer<typeof launchCreditSchema>
