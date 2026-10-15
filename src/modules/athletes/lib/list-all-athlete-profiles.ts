import {
  fetchAllSupabaseRows,
  type SupabaseRangeQuery,
} from '@/lib/supabase-pagination'

export type AthleteProfileListRow = {
  atleta_id: string
  papeis: string[]
  perfil_sugerido: string
  perfil_definido: string | null
  perfil_efetivo: string
}

type ProfileQuery = SupabaseRangeQuery<AthleteProfileListRow> & {
  order(column: string): SupabaseRangeQuery<AthleteProfileListRow>
}

type ProfileRpcClient = {
  rpc(name: 'list_atleta_perfis', args: { p_arena_id: string }): ProfileQuery
}

/** The untyped RPC returns a table, so PostgREST caps each response at 1,000. */
export function listAllAthleteProfiles(client: unknown, arenaId: string) {
  const query = (client as ProfileRpcClient)
    .rpc('list_atleta_perfis', { p_arena_id: arenaId })
    .order('atleta_id')

  return fetchAllSupabaseRows(query)
}
