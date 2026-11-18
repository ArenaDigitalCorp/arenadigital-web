import { fetchArenaMembershipsByUser } from '@/lib/arena-users'
import { getPlatformAccessLevel, loadArenaResources } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { loadOwnedArenas } from '@/lib/owned-arenas'
import type { ArenaSummary } from '@/lib/dashboard-bootstrap.types'

// Both the initial server render and the retry endpoint use the same tenant filter.
export async function loadAccessibleArenas(dbUserId: string): Promise<ArenaSummary[]> {
  if (await getPlatformAccessLevel(dbUserId) === 'platform_admin') {
    return []
  }
  const supabase = getSupabaseAdmin()

  const [ownedArenasResult, linkedArenasResult] = await Promise.all([
    loadOwnedArenas(dbUserId),
    fetchArenaMembershipsByUser(supabase, dbUserId, true),
  ])

  if (ownedArenasResult.error) {
    throw new Error(`Failed to load owned arenas: ${ownedArenasResult.error.message}`)
  }

  if (linkedArenasResult.error) {
    throw new Error(`Failed to load linked arenas: ${linkedArenasResult.error.message}`)
  }

  const arenaMap = new Map<string, Omit<ArenaSummary, 'resources'>>()

  for (const arena of ownedArenasResult.data ?? []) {
    arenaMap.set(arena.id, {
      id: arena.id,
      name: arena.name,
      isOwner: true,
      role: 'Owner',
      assignedStationId: null
    })
  }

  for (const link of linkedArenasResult.data ?? []) {
    if (arenaMap.has(link.arena_id)) continue

    const linkedArena = Array.isArray(link.arenas) ? link.arenas[0] : link.arenas
    if (!linkedArena?.id || !linkedArena.name) continue
    if (link.role !== 'Gestor' && link.role !== 'Atendente' && link.role !== 'Caixa') continue

    arenaMap.set(linkedArena.id, {
      id: linkedArena.id,
      name: linkedArena.name,
      isOwner: false,
      role: link.role,
      assignedStationId: link.station_id ?? null
    })
  }

  const arenas = [...arenaMap.values()].sort((a, b) => a.name.localeCompare(b.name))
  return Promise.all(arenas.map(async arena => ({ ...arena, resources: await loadArenaResources(arena.id) })))
}
