'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertPlatformSuperAdminAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { levelInputSchema, sportInputSchema, sportSchema } from './schema'

type CatalogRpcClient = { rpc: (name: 'list_platform_sport_catalog' | 'manage_platform_sport_catalog' | 'manage_platform_sport_level', args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> }
function client() { return getSupabaseAdmin() as unknown as CatalogRpcClient }
export async function listSportCatalog() {
  const profile = await assertPlatformSuperAdminAccess()
  const { data, error } = await client().rpc('list_platform_sport_catalog', { p_actor_user_id: profile.dbUserId })
  if (error) throw new Error('Não foi possível carregar o catálogo. Tente novamente.')
  return z.array(sportSchema).parse(data)
}
export async function saveSportCatalog(input: unknown) {
  const profile = await assertPlatformSuperAdminAccess()
  const parsed = sportInputSchema.safeParse(input)
  if (!parsed.success) return { error: 'Confira nome, classificação e justificativa (8 a 500 caracteres).' }
  const { reason, ...sport } = parsed.data
  const { error } = await client().rpc('manage_platform_sport_catalog', { p_actor_user_id: profile.dbUserId, p_id: sport.id, p_name: sport.name, p_category: sport.category, p_is_active: sport.is_active, p_requires_level: sport.requires_level, p_reason: reason })
  if (error) return { error: 'Não foi possível salvar. Confira se o nome já existe e tente novamente.' }
  revalidatePath('/admin/catalog')
  return { error: null }
}
export async function saveSportLevel(input: unknown) {
  const profile = await assertPlatformSuperAdminAccess()
  const parsed = levelInputSchema.safeParse(input)
  if (!parsed.success) return { error: 'Confira nome, ordem e justificativa (8 a 500 caracteres).' }
  const level = parsed.data
  const { error } = await client().rpc('manage_platform_sport_level', { p_actor_user_id: profile.dbUserId, p_id: level.id, p_sport_id: level.sport_id, p_name: level.name, p_is_active: level.is_active, p_sort_order: level.sort_order, p_reason: level.reason })
  if (error) return { error: 'Não foi possível salvar o nível. Confira se o nome já existe e tente novamente.' }
  revalidatePath('/admin/catalog')
  return { error: null }
}
