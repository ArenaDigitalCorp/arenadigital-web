import { z } from 'zod'
import { parseBrazilianDecimal } from '@/lib/format'

const priceInput = z.string().refine(value => {
  const amount = parseBrazilianDecimal(value)
  return amount !== null && amount >= 0
}, 'Informe um preço válido maior ou igual a zero.')

export const productFormSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  category_id: z.string().min(1, 'Selecione a categoria'),
  station_type_id: z.string().min(1, 'Selecione o tipo de estação'),
  price: priceInput,
  status: z.enum(['Ativo', 'Inativo']),
})

export const serviceFormSchema = productFormSchema.omit({ station_type_id: true })
export type ProductFormValues = z.infer<typeof productFormSchema>
export type ServiceFormValues = z.infer<typeof serviceFormSchema>
