import * as z from 'zod'

export const athleteFormSchema = z.object({
    name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres."),
    cpf: z.string().min(11, "CPF inválido."),
    phone: z.string().min(10, "Telefone inválido."),
    email: z.string().email("E-mail inválido."),
    birthDate: z.string().optional(),
    sport: z.string().min(1, "Selecione um esporte."),
    nivelHabilidade: z.string().optional(),
    cep: z.string().optional(),
    endereco: z.string().optional(),
    enderecoNumero: z.string().optional(),
    bairro: z.string().optional(),
    idMunicipio: z.number().optional(),
})

export type AthleteFormValues = z.infer<typeof athleteFormSchema>

export const linkAthleteSchema = z.object({
    name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres."),
    cpf: z.string().min(11, "CPF inválido."),
    phone: z.string().min(10, "Telefone inválido."),
    email: z.string().email("E-mail inválido."),
    sportId: z.string().min(1, "Selecione um esporte."),
    arenaId: z.string().min(1, "Arena é obrigatória."),
    nivelHabilidadeId: z.string().optional(),
    birthDate: z.string().optional(),
    cep: z.string().optional(),
    endereco: z.string().optional(),
    enderecoNumero: z.string().optional(),
    bairro: z.string().optional(),
    idMunicipio: z.number().optional(),
})

export type LinkAthleteInput = z.infer<typeof linkAthleteSchema>
