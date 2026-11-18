import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { AccessManagement } from './types'

type Arena = { p_arena_id: string }
type RpcDefinitions = {
  get_arena_access_management: [Arena, AccessManagement]
  save_arena_access_profile: [Arena & { p_profile_id: string | null; p_name: string; p_base_role: string; p_resources: string[]; p_expected_version: number | null }, string]
  archive_arena_access_profile: [Arena & { p_profile_id: string; p_expected_version: number }, null]
  set_arena_member_access: [Arena & { p_user_id: string; p_profile_id: string; p_status: string; p_station_id: string | null; p_expected_member_id: string | null }, string]
  remove_arena_member_access: [Arena & { p_user_id: string; p_expected_member_id: string }, null]
}

export async function accessRpc<Name extends keyof RpcDefinitions>(name: Name, args: RpcDefinitions[Name][0]): Promise<RpcDefinitions[Name][1]> {
  // Use the operator's session. Each database function derives the actor from auth.uid().
  const session = await createSupabaseServerClient()
  const { data, error } = await (session as unknown as {
    rpc(name: Name, args: RpcDefinitions[Name][0]): Promise<{data: RpcDefinitions[Name][1]; error: {code?: string; message: string} | null}>
  }).rpc(name, args)
  if (error?.code === '23505' && name === 'save_arena_access_profile') {
    throw new Error('Já existe um perfil com esse nome nesta arena.')
  }
  if (error) throw new Error(error.message)
  return data
}

export function loadAccessManagement(arenaId: string) {
  return accessRpc('get_arena_access_management', { p_arena_id: arenaId })
}
