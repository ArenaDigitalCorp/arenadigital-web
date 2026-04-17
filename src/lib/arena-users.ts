import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase.types'

type AppSupabaseClient = SupabaseClient<Database>

type ArenaMembershipRow = {
  id?: string
  arena_id: string
  role: string
  station_id: string | null
  user_id?: string
  arenas?: { id: string; name: string } | { id: string; name: string }[] | null
}

type ArenaUserRow = {
  id: string
  role: string
  station_id: string | null
  status: string
  created_at: string
  user_id: string
  users: {
    id: string
    name: string | null
    email: string
    clerk_user_id: string
  } | null
}

type QueryErrorLike = {
  message?: string
  code?: string
} | null | undefined

export function isArenaUsersStationColumnMissingError(error: QueryErrorLike) {
  const message = error?.message?.toLowerCase() ?? ''
  return (
    message.includes('arena_users.station_id') &&
    message.includes('does not exist')
  )
}

export function getArenaUsersStationColumnErrorMessage() {
  return 'Este ambiente ainda nao tem a coluna arena_users.station_id. Aplique a migration mais recente antes de usar Caixa vinculado a estacao.'
}

export async function fetchArenaMembershipByArenaAndUser(
  supabase: AppSupabaseClient,
  arenaId: string,
  userId: string
) {
  const query = () =>
    supabase
      .from('arena_users')
      .select('id, arena_id, role, station_id')
      .eq('arena_id', arenaId)
      .eq('user_id', userId)
      .in('status', ['Ativo', 'ativo', 'active'])
      .maybeSingle()

  const { data, error } = await query()

  if (!isArenaUsersStationColumnMissingError(error)) {
    return { data: data as ArenaMembershipRow | null, error }
  }

  const fallback = await supabase
    .from('arena_users')
    .select('id, arena_id, role')
    .eq('arena_id', arenaId)
    .eq('user_id', userId)
    .in('status', ['Ativo', 'ativo', 'active'])
    .maybeSingle()

  return {
    data: fallback.data
      ? ({ ...fallback.data, station_id: null } as ArenaMembershipRow)
      : null,
    error: fallback.error
  }
}

export async function fetchArenaMembershipsByUser(
  supabase: AppSupabaseClient,
  userId: string,
  includeArena = false
) {
  const selectWithStation = includeArena
    ? 'arena_id, role, station_id, arenas(id, name)'
    : 'arena_id, role, station_id'
  const selectWithoutStation = includeArena
    ? 'arena_id, role, arenas(id, name)'
    : 'arena_id, role'

  const { data, error } = await supabase
    .from('arena_users')
    .select(selectWithStation)
    .eq('user_id', userId)
    .in('status', ['Ativo', 'ativo', 'active'])

  if (!isArenaUsersStationColumnMissingError(error)) {
    return { data: (data ?? []) as unknown as ArenaMembershipRow[], error }
  }

  const fallback = await supabase
    .from('arena_users')
    .select(selectWithoutStation)
    .eq('user_id', userId)
    .in('status', ['Ativo', 'ativo', 'active'])

  return {
    data: ((fallback.data ?? []) as unknown as Omit<ArenaMembershipRow, 'station_id'>[]).map((row) => ({
      ...row,
      station_id: null
    })),
    error: fallback.error
  }
}

export async function fetchArenaUserLink(
  supabase: AppSupabaseClient,
  arenaId: string,
  arenaUserId: string
) {
  const { data, error } = await supabase
    .from('arena_users')
    .select('id, arena_id, station_id, user_id')
    .eq('id', arenaUserId)
    .eq('arena_id', arenaId)
    .single()

  if (!isArenaUsersStationColumnMissingError(error)) {
    return { data: data as ArenaMembershipRow | null, error }
  }

  const fallback = await supabase
    .from('arena_users')
    .select('id, arena_id, user_id')
    .eq('id', arenaUserId)
    .eq('arena_id', arenaId)
    .single()

  return {
    data: fallback.data
      ? ({ ...fallback.data, station_id: null } as ArenaMembershipRow)
      : null,
    error: fallback.error
  }
}

export async function fetchArenaUsersForArena(
  supabase: AppSupabaseClient,
  arenaId: string
) {
  const selectWithStation = `
    id,
    role,
    station_id,
    status,
    created_at,
    user_id,
    users (
      id,
      name,
      email,
      clerk_user_id
    )
  `

  const selectWithoutStation = `
    id,
    role,
    status,
    created_at,
    user_id,
    users (
      id,
      name,
      email,
      clerk_user_id
    )
  `

  const { data, error } = await supabase
    .from('arena_users')
    .select(selectWithStation)
    .eq('arena_id', arenaId)
    .order('created_at', { ascending: false })

  if (!isArenaUsersStationColumnMissingError(error)) {
    return { data: (data ?? []) as ArenaUserRow[], error }
  }

  const fallback = await supabase
    .from('arena_users')
    .select(selectWithoutStation)
    .eq('arena_id', arenaId)
    .order('created_at', { ascending: false })

  return {
    data: ((fallback.data ?? []) as Omit<ArenaUserRow, 'station_id'>[]).map((row) => ({
      ...row,
      station_id: null
    })),
    error: fallback.error
  }
}
