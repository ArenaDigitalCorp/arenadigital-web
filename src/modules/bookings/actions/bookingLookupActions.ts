'use server'

import { assertArenaResourceAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { SupabaseLoyaltyRepository } from '@/modules/loyalty/repositories/SupabaseLoyaltyRepository'
import { PERFIS_ATLETA, type PerfilAtleta } from '@/modules/athletes/types/perfil.types'

export async function searchBookingAthletesAction(arenaId: string, query: string) {
  try {
    await assertArenaResourceAccess(arenaId, 'bookings.single', 'bookings.recurring')
    if (query.trim().length < 2) return { success: true, data: [] }
    const athletes = await new SupabaseLoyaltyRepository(getSupabaseAdmin()).searchAthletes(arenaId, query.trim())
    return { success: true, data: athletes }
  } catch {
    return { success: false, data: [] }
  }
}

export async function listBookingServicesAction(arenaId: string) {
  try {
    await assertArenaResourceAccess(arenaId, 'bookings.single')
    const { data, error } = await getSupabaseAdmin().from('products')
      .select('id,name,price').eq('arena_id', arenaId).eq('catalog_kind', 'service').order('name')
    if (error) throw error
    return { success: true, data: data ?? [] }
  } catch {
    return { success: false, data: [] }
  }
}

export async function getBookingAthletePricingProfile(arenaId: string, athleteId: string): Promise<PerfilAtleta | null> {
  try {
    await assertArenaResourceAccess(arenaId, 'bookings.recurring')
    const client = getSupabaseAdmin() as unknown as {
      rpc(name: string, args: {p_arena_id: string; p_atleta_id: string}): Promise<{
        data: { perfil_efetivo?: PerfilAtleta } | null; error: unknown
      }>
    }
    const { data, error } = await client.rpc('get_atleta_perfil', { p_arena_id: arenaId, p_atleta_id: athleteId })
    const profile = data?.perfil_efetivo
    return !error && profile && PERFIS_ATLETA.includes(profile) ? profile : null
  } catch {
    return null
  }
}
