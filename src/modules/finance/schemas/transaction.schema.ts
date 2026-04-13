import * as z from 'zod'

export const transactionSchema = z.object({
    type: z.enum(["entrada", "saída"]),
    category: z.string().min(1, "Selecione uma categoria"),
    description: z.string().min(3, "Mínimo de 3 caracteres"),
    quantity: z.coerce.number().min(1, "Mínimo 1"),
    unit_value: z.coerce.number().min(0.01, "Mínimo R$ 0,01"),
    discount: z.coerce.number().min(0, "Mínimo 0"),
    total_value: z.coerce.number(),
    launch_date: z.string(),
    registration_date: z.string(),
    atleta_id: z.string().optional(),
    modo_pagamento_id: z.string().optional(),
})

export type TransactionFormValues = z.infer<typeof transactionSchema>
