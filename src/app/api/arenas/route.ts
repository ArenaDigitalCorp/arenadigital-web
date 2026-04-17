import { NextResponse } from 'next/server'
import { fetchArenaMembershipsByUser } from '@/lib/arena-users'
import { AuthorizationError, requireAuthenticatedDbUser } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'

type ArenaSummary = {
  id: string
  name: string
  isOwner: boolean
  role: 'Owner' | 'Gestor' | 'Atendente' | 'Caixa'
  assignedStationId: string | null
}

export async function GET() {
  try {
    const { dbUserId } = await requireAuthenticatedDbUser()
    const supabase = getSupabaseAdmin()

    const [ownedArenasResult, linkedArenasResult] = await Promise.all([
      supabase
        .from('arenas')
        .select('id, name')
        .eq('owner_id', dbUserId)
        .order('name'),
      fetchArenaMembershipsByUser(supabase, dbUserId, true)
    ])

    if (ownedArenasResult.error) {
      throw new Error(`Failed to load owned arenas: ${ownedArenasResult.error.message}`)
    }

    if (linkedArenasResult.error) {
      throw new Error(`Failed to load linked arenas: ${linkedArenasResult.error.message}`)
    }

    const arenaMap = new Map<string, ArenaSummary>()

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

    return NextResponse.json(
      [...arenaMap.values()].sort((a, b) => a.name.localeCompare(b.name))
    )
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('[api/arenas] Failed to load arenas', error)
    return NextResponse.json({ error: 'Failed to load arenas' }, { status: 500 })
  }
}
