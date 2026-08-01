import * as z from 'zod'

const nullableUuid = z.string().uuid().nullable().optional()

export const transactionActionSchema = z.object({
  type: z.enum(['entrada', 'saída']),
  category: z.string().trim().min(1).max(100),
  description: z.string().trim().min(3).max(500),
  quantity: z.coerce.number().int().min(1).max(100000),
  unit_value: z.coerce.number().finite().min(0.01).max(99999999.99),
  discount: z.coerce.number().finite().min(0).max(99999999.99),
  total_value: z.coerce.number().finite().min(0).max(99999999.99),
  launch_date: z.string().date(),
  registration_date: z.string().date(),
  atleta_id: nullableUuid,
  modo_pagamento_id: nullableUuid,
}).strict().superRefine((value, context) => {
  const calculatedTotal = Math.max(0, value.quantity * value.unit_value - value.discount)
  if (Math.abs(value.total_value - calculatedTotal) > 0.009) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['total_value'],
      message: 'Valor total divergente dos itens do lançamento',
    })
  }
})

export type TransactionActionInput = z.infer<typeof transactionActionSchema>
