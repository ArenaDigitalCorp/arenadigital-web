import * as z from 'zod'

export const courtSchema = z.object({
    name: z.string().min(2, "O nome do espaço deve ter pelo menos 2 caracteres."),
    status: z.enum(["ativo", "inativo", "Em manutenção", "Desativado"]),
    type: z.enum(["Quadra", "Espaço social"]),
    sportIds: z.array(z.string()).optional(),
    is_covered: z.boolean().default(false),
    observations: z.string().optional(),
    booking_type: z.enum(["unique", "hourly"]),
    image_url: z.string().optional(),
    day_config: z.array(z.any()).optional(),
    capacity: z.coerce.number().min(1, "A capacidade deve ser pelo menos 1.").optional(),
})

export type CourtFormValues = z.infer<typeof courtSchema>
