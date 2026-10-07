import { z } from 'zod'
export const levelSchema = z.object({ id: z.string().uuid(), nivel: z.string(), id_esporte: z.string().uuid(), is_active: z.boolean(), sort_order: z.number().int().nonnegative() })
export const sportSchema = z.object({ id: z.string().uuid(), name: z.string(), category: z.enum(['sport', 'space']), is_active: z.boolean(), requires_level: z.boolean(), levels: z.array(levelSchema) })
export type CatalogSport = z.infer<typeof sportSchema>
export const sportInputSchema = z.object({ id: z.string().uuid().nullable(), name: z.string().trim().min(2).max(100), category: z.enum(['sport', 'space']), is_active: z.boolean(), requires_level: z.boolean(), reason: z.string().trim().min(8).max(500) })
export const levelInputSchema = z.object({ id: z.string().uuid().nullable(), sport_id: z.string().uuid(), name: z.string().trim().min(1).max(100), is_active: z.boolean(), sort_order: z.number().int().nonnegative(), reason: z.string().trim().min(8).max(500) })
