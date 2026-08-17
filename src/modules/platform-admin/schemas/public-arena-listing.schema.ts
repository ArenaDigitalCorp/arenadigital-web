import { isValidCnpj, onlyDigits } from '@/lib/brasil-document'
import { z } from 'zod'

const optionalText = (max: number) => z.string().trim().max(max).optional()

export const publicArenaListingInputSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do local.').max(160),
  cnpj: z
    .string()
    .trim()
    .max(18)
    .optional()
    .transform((value) => onlyDigits(value))
    .refine((value) => value.length === 0 || isValidCnpj(value), 'Informe um CNPJ válido.'),
  address: z.string().trim().min(2, 'Informe o logradouro.').max(240),
  number: optionalText(30),
  complement: optionalText(120),
  neighborhood: optionalText(120),
  zipCode: z
    .string()
    .trim()
    .max(10)
    .optional()
    .transform((value) => onlyDigits(value))
    .refine((value) => value.length === 0 || value.length === 8, 'Informe um CEP válido.'),
  stateCode: z.number().int().positive('Selecione o estado.'),
  municipalityId: z.number().int().positive('Selecione o município.'),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .refine((value) => {
      const digits = onlyDigits(value)
      return digits.length === 0 || (digits.length >= 10 && digits.length <= 11)
    }, 'Informe um telefone válido.'),
  email: z
    .string()
    .trim()
    .max(254)
    .optional()
    .refine((value) => !value || z.email().safeParse(value).success, 'Informe um e-mail válido.'),
  description: optionalText(2000),
  sportIds: z.array(z.string().uuid()).min(1, 'Selecione ao menos um esporte.').max(30),
  platformNotes: optionalText(1000),
  reason: z.string().trim().min(8, 'Explique o motivo do cadastro em ao menos 8 caracteres.').max(500),
}).strict()

export type PublicArenaListingInput = z.input<typeof publicArenaListingInputSchema>
export type ParsedPublicArenaListingInput = z.output<typeof publicArenaListingInputSchema>
