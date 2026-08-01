import { createSupabaseServerClient } from '@/lib/supabase/server'
import { fetchArenaMembershipByArenaAndUser } from '@/lib/arena-users'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { resolveAuthenticatedDbUser } from '@/lib/account-identity'
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
  dbUserId: string
  authUserId: string
}

export type PlatformAdminProfile = AuthenticatedDbUser & {
  email: string
  name: string | null
  accessLevel: 'platform_admin' | 'super_admin'
}

export type PlatformAccessLevel = 'employee' | 'platform_admin' | 'super_admin'

export type ArenaMembershipRole = 'Gestor' | 'Atendente' | 'Caixa'

export type ArenaAccessProfile = AuthenticatedDbUser & {
  arenaId: string
  isOwner: boolean
  role: 'Owner' | ArenaMembershipRole
  assignedStationId: string | null
  arenaUserId: string | null
}

export const WEB_BACKOFFICE_ACCESS_DENIED_MESSAGE =
  'Esta conta é exclusiva do app de atletas e não acessa o painel web. Para gerenciar uma arena, cadastre uma conta gestora com outro e-mail.'

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

type PlatformAccessRpcClient = {
  rpc: (
    name: 'get_platform_access_level',
    args: { p_user_id: string },
  ) => Promise<{ data: string | null; error: { message: string } | null }>
}

function normalizeArenaMembershipRole(role: string | null | undefined): ArenaMembershipRole | null {
  if (role === 'Gestor' || role === 'Atendente' || role === 'Caixa') {
    return role
  }

  return null
}

async function getPlatformAccessLevel(dbUserId: string): Promise<PlatformAccessLevel | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await (supabase as unknown as PlatformAccessRpcClient).rpc(
    'get_platform_access_level',
    { p_user_id: dbUserId },
  )

  if (error) {
    throw new Error(`Failed to verify platform access: ${error.message}`)
  }

  if (data === 'employee' || data === 'platform_admin' || data === 'super_admin') {
    return data
  }

  return null
}

export async function requireAuthenticatedDbUser(): Promise<AuthenticatedDbUser> {
  const supabaseSession = await createSupabaseServerClient()
  const { data: authData, error: authError } = await supabaseSession.auth.getUser()

  if (authError || !authData.user) {
    throw new AuthorizationError('Unauthorized', 401)
  }

  const authUserId = authData.user.id
  const supabase = getSupabaseAdmin()
  const data = await resolveAuthenticatedDbUser(supabase, authUserId)

  if (!data) {
    throw new AuthorizationError('User not provisioned', 404)
  }

  return {
    authUserId,
    dbUserId: data.id,
  }
}

export async function hasWebBackofficeAccess(dbUserId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  const platformAccessLevel = await getPlatformAccessLevel(dbUserId)

  if (platformAccessLevel === 'platform_admin' || platformAccessLevel === 'super_admin') return true

  const { data: ownedArena, error: ownedArenaError } = await supabase
    .from('arenas')
    .select('id')
    .eq('owner_id', dbUserId)
    .limit(1)
    .maybeSingle()

  if (ownedArenaError) {
    throw new Error(`Failed to verify web access arena ownership: ${ownedArenaError.message}`)
  }

  if (ownedArena) return true

  const { data: linkedArena, error: linkedArenaError } = await supabase
    .from('arena_users')
    .select('id')
    .eq('user_id', dbUserId)
    .in('role', ['Gestor', 'Atendente', 'Caixa'])
    .in('status', ['Ativo', 'ativo', 'active'])
    .limit(1)
    .maybeSingle()

  if (linkedArenaError) {
    throw new Error(`Failed to verify web access arena membership: ${linkedArenaError.message}`)
  }

  return Boolean(linkedArena)
}

export async function requireWebBackofficeAccess(): Promise<AuthenticatedDbUser> {
  const currentUser = await requireAuthenticatedDbUser()
  const canAccessWeb = await hasWebBackofficeAccess(currentUser.dbUserId)

  if (!canAccessWeb) {
    throw new AuthorizationError(WEB_BACKOFFICE_ACCESS_DENIED_MESSAGE, 403)
  }

  return currentUser
}

/**
 * Arena creation is a tenant-ownership operation. It is intentionally limited
 * to platform admins and users who already own an arena; first-arena creation
 * is performed by the protected signup provisioning flow.
 */
export async function assertArenaCreationAccess(): Promise<AuthenticatedDbUser> {
  const currentUser = await requireAuthenticatedDbUser()
  const supabase = getSupabaseAdmin()

  const [platformAccessLevel, { data: ownedArena, error: arenaError }] = await Promise.all([
    getPlatformAccessLevel(currentUser.dbUserId),
    supabase
      .from('arenas')
      .select('id')
      .eq('owner_id', currentUser.dbUserId)
      .limit(1)
      .maybeSingle(),
  ])

  if (arenaError) {
    throw new Error(`Failed to verify arena ownership: ${arenaError.message}`)
  }

  const isPlatformAdmin = platformAccessLevel === 'platform_admin' || platformAccessLevel === 'super_admin'
  if (!isPlatformAdmin && !ownedArena) {
    throw new AuthorizationError('Forbidden', 403)
  }

  return currentUser
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

export async function assertPlatformAdminAccess(): Promise<PlatformAdminProfile> {
  const currentUser = await requireAuthenticatedDbUser()
  const supabase = getSupabaseAdmin()

  const accessLevel = await getPlatformAccessLevel(currentUser.dbUserId)
  if (accessLevel !== 'platform_admin' && accessLevel !== 'super_admin') {
    throw new AuthorizationError('Forbidden', 403)
  }

  const { data, error } = await supabase
    .from('users')
    .select('email, name')
    .eq('id', currentUser.dbUserId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to verify platform admin access: ${error.message}`)
  }

  if (!data) {
    throw new AuthorizationError('Forbidden', 403)
  }

  return {
    ...currentUser,
    email: data.email,
    name: data.name,
    accessLevel,
  }
}

export async function assertArenaBackofficeAccess(arenaId: string): Promise<ArenaAccessProfile> {
  const access = await assertArenaAccess(arenaId)

  if (!access.isOwner && access.role === 'Caixa') {
    throw new AuthorizationError('Forbidden', 403)
  }

  return access
}

/**
 * Protege rotas exclusivas de Administrador (Owner | Gestor).
 * Bloqueia Caixa e Atendente.
 * Uso: Espaços, Relatórios, Configurações de Arena/Usuários.
 */
export async function assertArenaAdminAccess(arenaId: string): Promise<ArenaAccessProfile> {
  const access = await assertArenaAccess(arenaId)

  if (!access.isOwner && access.role !== 'Gestor') {
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
