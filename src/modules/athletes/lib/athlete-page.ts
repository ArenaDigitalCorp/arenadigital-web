import { z } from 'zod'
import type { AthletePage, AthletePageQuery } from '../types/list-page.types'

export const athletePageSchema = z.object({
  arenaId: z.string().uuid(),
  page: z.number().int().min(1).max(2147483647),
  pageSize: z.union([z.literal(25), z.literal(50)]),
  search: z.string().trim().max(120),
  profile: z.enum(['todos', 'padrao', 'mensalista', 'professor']),
  sort: z.object({
    column: z.enum(['name', 'sport', 'perfil']),
    direction: z.enum(['asc', 'desc']),
  }),
})

type PageClient = {
  rpc(name: 'list_arena_athletes_page', args: Record<string, unknown>): PromiseLike<{
    data: AthletePage | null
    error: { message: string } | null
  }>
}

export async function fetchAthletePage(client: unknown, arenaId: string, query: AthletePageQuery): Promise<AthletePage> {
  const { data, error } = await (client as PageClient).rpc('list_arena_athletes_page', {
    p_arena_id: arenaId, p_page: query.page, p_page_size: query.pageSize, p_search: query.search,
    p_profile: query.profile, p_sort_by: query.sort.column,
    p_sort_direction: query.sort.direction,
  })
  if (error) throw new Error(error.message)
  if (!data || data.pageSize !== query.pageSize || !Array.isArray(data.items) || data.items.length > query.pageSize) {
    throw new Error('Resposta inválida ao buscar a página de atletas.')
  }
  return data
}
