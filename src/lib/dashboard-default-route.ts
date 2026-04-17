import { fetchArenaMembershipsByUser } from '@/lib/arena-users'
import { requireAuthenticatedDbUser } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'

type DashboardSection =
  | 'arena'
  | 'stations'
  | 'finance'
  | 'products'
  | 'loyalty'
  | 'rotativo'
  | 'athletes'
  | 'users'
  | 'subscription'

type AccessibleArenaTarget = {
  arenaId: string
  isOwner: boolean
  role: 'Owner' | 'Gestor' | 'Atendente' | 'Caixa'
  assignedStationId: string | null
  name: string
}

async function getAccessibleArenaTargets(): Promise<AccessibleArenaTarget[]> {
  const { dbUserId } = await requireAuthenticatedDbUser()
  const supabase = getSupabaseAdmin()

  const [ownedArenasResult, linkedArenasResult] = await Promise.all([
    supabase.from('arenas').select('id, name').eq('owner_id', dbUserId).order('name'),
    fetchArenaMembershipsByUser(supabase, dbUserId, true)
  ])

  if (ownedArenasResult.error) {
    throw new Error(`Failed to load owned arenas: ${ownedArenasResult.error.message}`)
  }

  if (linkedArenasResult.error) {
    throw new Error(`Failed to load linked arenas: ${linkedArenasResult.error.message}`)
  }

  const arenaMap = new Map<string, AccessibleArenaTarget>()

  for (const arena of ownedArenasResult.data ?? []) {
    arenaMap.set(arena.id, {
      arenaId: arena.id,
      isOwner: true,
      role: 'Owner',
      assignedStationId: null,
      name: arena.name
    })
  }

  for (const link of linkedArenasResult.data ?? []) {
    if (arenaMap.has(link.arena_id)) continue

    const linkedArena = Array.isArray(link.arenas) ? link.arenas[0] : link.arenas
    if (!linkedArena?.id || !linkedArena.name) continue
    if (link.role !== 'Gestor' && link.role !== 'Atendente' && link.role !== 'Caixa') continue

    arenaMap.set(linkedArena.id, {
      arenaId: linkedArena.id,
      isOwner: false,
      role: link.role,
      assignedStationId: link.station_id ?? null,
      name: linkedArena.name
    })
  }

  return [...arenaMap.values()].sort((a, b) => {
    if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export async function resolveDashboardDefaultRoute(section: DashboardSection): Promise<string> {
  const arenas = await getAccessibleArenaTargets()

  if (section === 'subscription') {
    const subscriptionArena = arenas.find((arena) => arena.isOwner || arena.role === 'Gestor')
    return subscriptionArena
      ? `/dashboard/settings/subscription/${subscriptionArena.arenaId}`
      : '/dashboard/settings/arenas'
  }

  const primaryArena = arenas[0]
  if (!primaryArena) {
    return '/dashboard/settings/arenas'
  }

  if (!primaryArena.isOwner && primaryArena.role === 'Caixa') {
    return primaryArena.assignedStationId
      ? `/dashboard/arenas/${primaryArena.arenaId}/stations/${primaryArena.assignedStationId}`
      : '/dashboard'
  }

  switch (section) {
    case 'arena':
      return `/dashboard/arenas/${primaryArena.arenaId}`
    case 'stations':
      return `/dashboard/arenas/${primaryArena.arenaId}/stations`
    case 'finance':
      return `/dashboard/finance/${primaryArena.arenaId}`
    case 'products':
      return `/dashboard/settings/products/${primaryArena.arenaId}`
    case 'loyalty':
      return `/dashboard/loyalty/${primaryArena.arenaId}`
    case 'rotativo':
      return `/dashboard/rotativo/${primaryArena.arenaId}`
    case 'athletes':
      return `/dashboard/athletes/${primaryArena.arenaId}`
    case 'users':
      return `/dashboard/settings/users/${primaryArena.arenaId}`
    default:
      return '/dashboard'
  }
}
