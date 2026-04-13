import * as z from 'zod'

export const rotativoSchema = z.object({
    id_esporte: z.string().min(1, "Selecione o esporte"),
    hora_inicio: z.string().min(5, "Hora de início é obrigatória"),
    hora_fim: z.string().min(5, "Hora de fim é obrigatória"),
    valor: z.string().min(1, "Valor é obrigatório"),
    limitado: z.boolean(),
    limite_participantes: z.string().optional(),
})

export type RotativoFormValues = z.infer<typeof rotativoSchema>

export const createRotativoInputSchema = rotativoSchema.extend({
    arenaId: z.string().uuid(),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
    valor: z.number().positive("Valor deve ser positivo"),
    limite_participantes: z.number().nullable().optional(),
})

export type CreateRotativoInput = z.infer<typeof createRotativoInputSchema>
