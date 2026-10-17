import * as z from 'zod'
import { cpfSchema, emailSchema, optionalCepSchema, phoneSchema } from '@/shared/schemas/contact.schema'

export const athleteFormSchema = z.object({
    name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres."),
    cpf: cpfSchema,
    phone: phoneSchema,
    email: emailSchema,
    birthDate: z.string().optional(),
    sport: z.string().min(1, "Selecione um esporte."),
    nivelHabilidade: z.string().optional(),
    cep: optionalCepSchema,
    endereco: z.string().optional(),
    enderecoNumero: z.string().optional(),
    bairro: z.string().optional(),
    idMunicipio: z.number().optional(),
})

export type AthleteFormValues = z.infer<typeof athleteFormSchema>

export const lookupAthleteByCpfSchema = z.object({
    cpf: cpfSchema,
    arenaId: z.string().min(1, "Arena é obrigatória."),
})

export type LookupAthleteByCpfInput = z.infer<typeof lookupAthleteByCpfSchema>

export const linkExistingAthleteSchema = z.object({
    athleteId: z.string().uuid("Atleta inválido."),
    arenaId: z.string().min(1, "Arena é obrigatória."),
})

export type LinkExistingAthleteInput = z.infer<typeof linkExistingAthleteSchema>

export const linkAthleteSchema = z.object({
    name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres."),
    cpf: cpfSchema,
    phone: phoneSchema,
    email: emailSchema,
    sportId: z.string().min(1, "Selecione um esporte."),
    arenaId: z.string().min(1, "Arena é obrigatória."),
    nivelHabilidadeId: z.string().optional(),
    birthDate: z.string().optional(),
    cep: optionalCepSchema,
    endereco: z.string().optional(),
    enderecoNumero: z.string().optional(),
    bairro: z.string().optional(),
    idMunicipio: z.number().optional(),
})

export type LinkAthleteInput = z.infer<typeof linkAthleteSchema>
