import * as z from 'zod'

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional()
const optionalUuid = z.string().uuid().nullable().optional()
const optionalDateTime = z.string().datetime().nullable().optional()

export const appHomeContentActionSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(['announcement', 'promotion', 'ad', 'news']),
  title: z.string().trim().min(1).max(160),
  description: optionalText(2000),
  image_url: optionalText(2048),
  cta_label: optionalText(120),
  cta_url: optionalText(2048),
  cta_kind: z.enum(['none', 'external_url', 'go_to_jogos', 'go_to_buscar', 'go_to_perfil']).optional(),
  city_id: z.number().int().positive().nullable().optional(),
  sport_id: optionalUuid,
  priority: z.number().int().min(-100000).max(100000).optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: optionalDateTime,
  active: z.boolean().optional(),
}).strict()

export const arenaPromotionActionSchema = z.object({
  id: z.string().uuid().optional(),
  court_id: optionalUuid,
  sport_id: optionalUuid,
  title: z.string().trim().min(1).max(160),
  description: optionalText(2000),
  image_url: optionalText(2048),
  price: z.number().nonnegative().max(99999999.99).nullable().optional(),
  original_price: z.number().nonnegative().max(99999999.99).nullable().optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: optionalDateTime,
  weekday: z.number().int().min(0).max(6).nullable().optional(),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  active: z.boolean().optional(),
  priority: z.number().int().min(-100000).max(100000).optional(),
}).strict()

export const arenaHighlightActionSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(160),
  description: optionalText(2000),
  image_url: optionalText(2048),
  starts_at: z.string().datetime().optional(),
  ends_at: optionalDateTime,
  city_id: z.number().int().positive().nullable().optional(),
  sport_id: optionalUuid,
  active: z.boolean().optional(),
  priority: z.number().int().min(-100000).max(100000).optional(),
}).strict()

export const openGameActionSchema = z.object({
  id: z.string().uuid().optional(),
  booking_id: optionalUuid,
  sport_id: z.string().uuid(),
  owner_atleta_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  needed_players: z.number().int().positive().max(100).optional(),
  current_players: z.number().int().nonnegative().max(100).optional(),
  level_min_id: optionalUuid,
  level_max_id: optionalUuid,
  status: z.enum(['open', 'full', 'cancelled', 'finished']).optional(),
  visibility: z.enum(['public', 'connections', 'team']).optional(),
  notes: optionalText(2000),
}).strict()

export type AppHomeContentActionInput = z.infer<typeof appHomeContentActionSchema>
export type ArenaPromotionActionInput = z.infer<typeof arenaPromotionActionSchema>
export type ArenaHighlightActionInput = z.infer<typeof arenaHighlightActionSchema>
export type OpenGameActionInput = z.infer<typeof openGameActionSchema>
