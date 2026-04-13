import * as z from 'zod'

/** Schema used in the client-side registration form */
export const athleteFormSchema = z.object({
    name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres."),
    cpf: z.string().min(11, "CPF inválido."),
    phone: z.string().min(10, "Telefone inválido."),
    email: z.string().email("E-mail inválido."),
    sport: z.string().min(1, "Selecione um esporte."),
})

export type AthleteFormValues = z.infer<typeof athleteFormSchema>

/** Schema used by the linkAthlete server action */
export const linkAthleteSchema = z.object({
    name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres."),
    cpf: z.string().min(11, "CPF inválido."),
    phone: z.string().min(10, "Telefone inválido."),
    email: z.string().email("E-mail inválido."),
    sportId: z.string().min(1, "Selecione um esporte."),
    arenaId: z.string().min(1, "Arena é obrigatória."),
})

export type LinkAthleteInput = z.infer<typeof linkAthleteSchema>
