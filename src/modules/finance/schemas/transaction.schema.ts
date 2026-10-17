import * as z from 'zod'
import { decimalInput, integerInput } from '@/shared/schemas/numeric.schema'

export const transactionSchema = z.object({
    type: z.enum(["entrada", "saída"]),
    category: z.string().min(1, "Selecione uma categoria"),
    description: z.string().min(3, "Mínimo de 3 caracteres"),
    quantity: integerInput(z.number().int().min(1, "Mínimo 1")),
    unit_value: decimalInput(z.number().min(0.01, "Mínimo R$ 0,01")),
    discount: decimalInput(z.number().min(0, "Mínimo 0")),
    total_value: decimalInput(z.number()),
    launch_date: z.string(),
    registration_date: z.string(),
    atleta_id: z.string().optional(),
    modo_pagamento_id: z.string({ error: "Selecione o modo de pagamento" }).min(1, "Selecione o modo de pagamento"),
})

export type TransactionFormValues = z.infer<typeof transactionSchema>
