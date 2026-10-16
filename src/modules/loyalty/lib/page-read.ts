import { z } from 'zod'

const common = {
  arenaId: z.string().uuid(),
  userId: z.string().uuid(),
  page: z.number().int().min(1).max(100000),
  search: z.string().max(200),
}
export const loyaltyPageReadSchema = z.discriminatedUnion('kind', [
  z.object({ ...common, kind: z.literal('statement'),
    startDate: z.string().datetime().optional(), endDate: z.string().datetime().optional(),
  }).strict(),
  z.object({ ...common, kind: z.literal('ranking') }).strict(),
])
export type LoyaltyPageRead = z.infer<typeof loyaltyPageReadSchema>
