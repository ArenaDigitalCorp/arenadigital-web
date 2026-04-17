import { auth } from '@clerk/nextjs/server'
import { fetchArenaMembershipByArenaAndUser } from '@/lib/arena-users'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import type { Database } from '@/types/supabase.types'

export class AuthorizationError extends Error {
  status: number

  constructor(message: string, status = 403) {
    super(message)
    this.name = 'AuthorizationError'
    this.status = status
  }
}

export type AuthenticatedDbUser = {
  clerkUserId: string
  dbUserId: string
}

export type ArenaMembershipRole = 'Gestor' | 'Atendente' | 'Caixa'

export type ArenaAccessProfile = AuthenticatedDbUser & {
  arenaId: string
  isOwner: boolean
  role: 'Owner' | ArenaMembershipRole
  assignedStationId: string | null
  arenaUserId: string | null
}

type PublicTableName = keyof Database['public']['Tables']

type ArenaScopedResourceOptions = {
  idColumn?: string
  arenaColumn?: string
  expectedArenaId?: string
  notFoundMessage?: string
}

type UntypedArenaQuery = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>
    }
  }
}

function normalizeArenaMembershipRole(role: string | null | undefined): ArenaMembershipRole | null {
  if (role === 'Gestor' || role === 'Atendente' || role === 'Caixa') {
    return role
  }

  return null
}

export async function requireAuthenticatedDbUser(): Promise<AuthenticatedDbUser> {
  const { userId } = await auth()

  if (!userId) {
    throw new AuthorizationError('Unauthorized', 401)
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load current db user: ${error.message}`)
  }

  if (!data) {
    throw new AuthorizationError('User not provisioned', 404)
  }

  return {
    clerkUserId: userId,
    dbUserId: data.id,
  }
}

export async function assertArenaAccess(arenaId: string): Promise<ArenaAccessProfile> {
  const currentUser = await requireAuthenticatedDbUser()
  const supabase = getSupabaseAdmin()

  const { data: ownedArena, error: ownerError } = await supabase
    .from('arenas')
    .select('id')
    .eq('id', arenaId)
    .eq('owner_id', currentUser.dbUserId)
    .maybeSingle()

  if (ownerError) {
    throw new Error(`Failed to verify arena ownership: ${ownerError.message}`)
  }

  if (ownedArena) {
    return {
      ...currentUser,
      arenaId,
      isOwner: true,
      role: 'Owner',
      assignedStationId: null,
      arenaUserId: null,
    }
  }

  const { data: linkedArena, error: linkedError } = await fetchArenaMembershipByArenaAndUser(
    supabase,
    arenaId,
    currentUser.dbUserId
  )

  if (linkedError) {
    throw new Error(`Failed to verify arena membership: ${linkedError.message}`)
  }

  if (!linkedArena) {
    throw new AuthorizationError('Forbidden', 403)
  }

  const role = normalizeArenaMembershipRole(linkedArena.role)
  if (!role) {
    throw new AuthorizationError('Forbidden', 403)
  }

  return {
    ...currentUser,
    arenaId,
    isOwner: false,
    role,
    assignedStationId: linkedArena.station_id ?? null,
    arenaUserId: linkedArena.id ?? null,
  }
}

export async function assertArenaBackofficeAccess(arenaId: string): Promise<ArenaAccessProfile> {
  const access = await assertArenaAccess(arenaId)

  if (!access.isOwner && access.role === 'Caixa') {
    throw new AuthorizationError('Forbidden', 403)
  }

  return access
}

export async function assertArenaOwnerAccess(arenaId: string): Promise<ArenaAccessProfile> {
  const access = await assertArenaAccess(arenaId)

  if (!access.isOwner) {
    throw new AuthorizationError('Forbidden', 403)
  }

  return access
}

export async function assertArenaSubscriptionAccess(arenaId: string): Promise<ArenaAccessProfile> {
  const access = await assertArenaAccess(arenaId)

  if (!access.isOwner && access.role !== 'Gestor') {
    throw new AuthorizationError('Forbidden', 403)
  }

  return access
}

async function assertStationMembershipAccess(arenaId: string, stationId: string): Promise<ArenaAccessProfile> {
  const access = await assertArenaAccess(arenaId)

  if (!access.isOwner && access.role === 'Caixa' && access.assignedStationId !== stationId) {
    throw new AuthorizationError('Forbidden', 403)
  }

  return access
}

export async function assertArenaScopedResourceAccess(
  table: PublicTableName,
  resourceId: string,
  {
    idColumn = 'id',
    arenaColumn = 'arena_id',
    expectedArenaId,
    notFoundMessage = 'Resource not found',
  }: ArenaScopedResourceOptions = {},
): Promise<string> {
  const supabase = getSupabaseAdmin()
  const query = supabase.from(table) as unknown as UntypedArenaQuery
  const { data, error } = await query
    .select(arenaColumn)
    .eq(idColumn, resourceId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load ${String(table)} resource: ${error.message}`)
  }

  if (!data) {
    throw new AuthorizationError(notFoundMessage, 404)
  }

  const arenaId = (data as Record<string, unknown>)[arenaColumn]
  if (typeof arenaId !== 'string' || arenaId.length === 0) {
    throw new Error(`Resource ${String(table)} is missing a valid ${arenaColumn}`)
  }

  if (expectedArenaId && arenaId !== expectedArenaId) {
    throw new AuthorizationError('Forbidden', 403)
  }

  await assertArenaAccess(arenaId)
  return arenaId
}

export function assertCourtAccess(courtId: string, expectedArenaId?: string) {
  return assertArenaScopedResourceAccess('courts', courtId, {
    expectedArenaId,
    notFoundMessage: 'Court not found',
  })
}

export function assertBookingAccess(bookingId: string, expectedArenaId?: string) {
  return assertArenaScopedResourceAccess('bookings', bookingId, {
    expectedArenaId,
    notFoundMessage: 'Booking not found',
  })
}

export function assertProductAccess(productId: string, expectedArenaId?: string) {
  return assertArenaScopedResourceAccess('products', productId, {
    expectedArenaId,
    notFoundMessage: 'Product not found',
  })
}

export function assertStationAccess(stationId: string, expectedArenaId?: string) {
  return (async () => {
    const arenaId = await assertArenaScopedResourceAccess('stations', stationId, {
      expectedArenaId,
      notFoundMessage: 'Station not found',
    })

    await assertStationMembershipAccess(arenaId, stationId)
    return arenaId
  })()
}

export function assertStationOrderAccess(orderId: string, expectedArenaId?: string) {
  return (async () => {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('station_orders')
      .select('arena_id, station_id')
      .eq('id', orderId)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to load station order resource: ${error.message}`)
    }

    if (!data) {
      throw new AuthorizationError('Order not found', 404)
    }

    if (expectedArenaId && data.arena_id !== expectedArenaId) {
      throw new AuthorizationError('Forbidden', 403)
    }

    await assertStationMembershipAccess(data.arena_id, data.station_id)
    return data.arena_id
  })()
}

export function assertRotativoAccess(rotativoId: string, expectedArenaId?: string) {
  return assertArenaScopedResourceAccess('rotativos', rotativoId, {
    arenaColumn: 'id_arena',
    expectedArenaId,
    notFoundMessage: 'Rotativo not found',
  })
}
