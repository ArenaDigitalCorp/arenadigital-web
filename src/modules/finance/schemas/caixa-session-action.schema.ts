import * as z from 'zod'
import { decimalInput } from '@/shared/schemas/numeric.schema'

export const openCaixaSessionActionSchema = z.object({
  opening_balance: decimalInput(z.number().finite().min(0).max(99999999.99)),
  opening_notes: z.string().trim().max(500).nullable().optional(),
}).strict()

export type OpenCaixaSessionActionInput = z.infer<typeof openCaixaSessionActionSchema>

export const closeCaixaSessionActionSchema = z.object({
  session_id: z.string().uuid(),
  closing_notes: z.string().trim().max(500).nullable().optional(),
}).strict()

export type CloseCaixaSessionActionInput = z.infer<typeof closeCaixaSessionActionSchema>
