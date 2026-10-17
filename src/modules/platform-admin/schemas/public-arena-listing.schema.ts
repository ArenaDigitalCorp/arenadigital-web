import { isValidCnpj, normalizeCpfCnpj } from '@/lib/brasil-document'
import { z } from 'zod'
import { optionalCepSchema, optionalEmailSchema, optionalPhoneSchema } from '@/shared/schemas/contact.schema'
import { getArenaLegalNameError } from '@/modules/arenas/domain/arena-legal-name'

const optionalText = (max: number) => z.string().trim().max(max).optional()

export const publicArenaListingInputSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do local.').max(160),
  legalName: z.string().trim().optional(),
  cnpj: z
    .string()
    .trim()
    .max(18)
    .optional()
    .transform((value) => normalizeCpfCnpj(value ?? ''))
    .refine((value) => value.length === 0 || isValidCnpj(value), 'Informe um CNPJ válido.'),
  address: z.string().trim().min(2, 'Informe o logradouro.').max(240),
  number: optionalText(30),
  complement: optionalText(120),
  neighborhood: optionalText(120),
  zipCode: optionalCepSchema,
  stateCode: z.number().int().positive('Selecione o estado.'),
  municipalityId: z.number().int().positive('Selecione o município.'),
  phone: optionalPhoneSchema,
  email: optionalEmailSchema,
  description: optionalText(2000),
  sportIds: z.array(z.string().uuid()).min(1, 'Selecione ao menos um esporte.').max(30),
  platformNotes: optionalText(1000),
  reason: z.string().trim().min(8, 'Explique o motivo do cadastro em ao menos 8 caracteres.').max(500),
}).strict().superRefine((value, ctx) => {
  const message = getArenaLegalNameError(value.cnpj, value.legalName)
  if (message) ctx.addIssue({ code: 'custom', path: ['legalName'], message })
})

export type PublicArenaListingInput = z.input<typeof publicArenaListingInputSchema>
export type ParsedPublicArenaListingInput = z.output<typeof publicArenaListingInputSchema>
