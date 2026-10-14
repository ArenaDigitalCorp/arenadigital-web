import { isValidCpfOrCnpj } from '@/lib/brasil-document'
import { APP_BOOKING_MODES } from '@/modules/arenas/domain/app-booking-mode'
import { getArenaLegalNameError } from '@/modules/arenas/domain/arena-legal-name'
import * as z from 'zod'

const arenaBaseSchema = z.object({
    name: z.string().min(2, "O nome da arena deve ter pelo menos 2 caracteres."),
    legal_name: z.string().trim().nullable().optional(),
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
    cpf_cnpj: z
        .string()
        .nullable()
        .optional()
        .refine((v) => isValidCpfOrCnpj(v ?? ''), {
            message: 'Informe um CPF ou CNPJ válido, ou deixe em branco.',
        }),
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
    app_booking_mode: z.enum(APP_BOOKING_MODES).optional(),
    accepts_app_booking_requests: z.boolean().optional(),
})

export const arenaUpdateSchema = arenaBaseSchema.partial()

export const arenaSchema = arenaBaseSchema.superRefine((value, ctx) => {
    const message = getArenaLegalNameError(value.cpf_cnpj, value.legal_name)
    if (message) ctx.addIssue({ code: 'custom', path: ['legal_name'], message })
})

export type ArenaFormValues = z.infer<typeof arenaSchema>
