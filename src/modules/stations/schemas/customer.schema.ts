import { z } from 'zod'
import { optionalCpfSchema, optionalEmailSchema, optionalPhoneSchema } from '@/shared/schemas/contact.schema'

export const registerCustomerSchema = z.object({
  name: z.string().trim().min(2, 'O nome deve ter pelo menos 2 caracteres.'),
  cpf: optionalCpfSchema,
  phone: optionalPhoneSchema,
  email: optionalEmailSchema,
}).strict()
