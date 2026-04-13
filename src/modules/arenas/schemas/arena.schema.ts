import * as z from 'zod'

export const arenaSchema = z.object({
    name: z.string().min(2, "O nome da arena deve ter pelo menos 2 caracteres."),
    status: z.enum(["ativo", "inativo", "Em manutenção"]),
    sports: z.array(z.string()).optional(),
    comodidades: z.array(z.string()).optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    description: z.string().optional(),
    banner_url: z.string().optional(),
    address: z.string().min(2, "O logradouro é obrigatório."),
    neighborhood: z.string().optional(),
    number: z.string().optional(),
    complement: z.string().optional(),
    id_municipio: z.number({ message: "O município é obrigatório" }),
    zip_code: z.string().optional(),
    facebook: z.string().optional(),
    instagram: z.string().optional(),
    tiktok: z.string().optional(),
    opening_hours: z.record(
        z.string(),
        z.object({
            isOpen: z.boolean(),
            start: z.string(),
            end: z.string(),
        })
    ).optional(),
})

export type ArenaFormValues = z.infer<typeof arenaSchema>
