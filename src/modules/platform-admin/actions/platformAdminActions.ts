"use server"

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertPlatformAdminAccess, assertPlatformSuperAdminAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import type { ArenaPixSplitSettings, ArenaPixSplitStatus } from '@/modules/arenas/types/pix-split.types'
import type {
  PlatformAccessLevel,
  PlatformAdminActionResult,
  PlatformAdminOverview,
  PlatformArena,
  PlatformAthlete,
  PlatformAuditEvent,
  PlatformInternalPlanAssignment,
  PlatformMembership,
  PlatformPrincipal,
  PlatformUser,
} from '@/modules/platform-admin/types/platform-admin.types'

type PlatformRpcClient = {
  rpc: (
    name:
      | 'list_platform_principals'
      | 'list_platform_security_audit'
      | 'list_internal_employee_plan_assignments'
      | 'manage_platform_principal'
      | 'manage_internal_employee_plan',
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>
}

type ArenaRow = {
  id: string
  name: string
  status: string | null
  owner_id: string | null
  created_at: string
  owner: { id: string; name: string | null; email: string } | { id: string; name: string | null; email: string }[] | null
  id_municipio: number | null
  location: unknown
}

type SubscriptionRow = {
  arena_id: string
  plan_key: string
  status: string
  current_period_end: string | null
  plan: { label: string; price_cents: number; is_internal: boolean } | { label: string; price_cents: number; is_internal: boolean }[] | null
}

type AthleteRow = {
  id: string
  id_users: string
  nome_perfil: string
  origem_cadastro: string
  id_arena_cadastro: string | null
  created_at: string
  updated_at: string
  user: { email: string } | { email: string }[] | null
}

type ArenaAthleteRow = { id_arena: string; id_atleta: string }
type CourtRow = { arena_id: string; status: string | null }
type BookingActivityRow = { arena_id: string; athlete_id: string | null; start_time: string; status: string | null }
type AthleteEntitlementRow = { atleta_id: string; plan: 'free' | 'plus'; status: string }
type MunicipalityRow = { codigo_ibge: number; nome: string; codigo_uf: number }
type StateRow = { codigo_uf: number; uf: string }

type ArenaPaymentAccountRow = {
  arena_id: string
  asaas_wallet_id: string | null
  asaas_account_id: string | null
  holder_name: string | null
  holder_document: string | null
  pix_key: string | null
  platform_fee_basis_points: number | null
  status: string | null
  updated_at: string | null
}

type PrincipalRow = {
  user_id: string
  email: string
  name: string | null
  access_level: PlatformAccessLevel
  status: 'active' | 'revoked'
  expires_at: string | null
  created_at: string
  updated_at: string
}

type AuditRow = {
  id: number
  event_type: string
  actor_user_id: string | null
  target_user_id: string | null
  arena_id: string | null
  reason: string
  metadata: Record<string, unknown> | null
  created_at: string
}

type InternalPlanAssignmentRow = {
  arena_id: string
  employee_user_id: string
  granted_by_user_id: string | null
  reason: string
  granted_at: string
  updated_at: string
}

const principalInputSchema = z.object({
  targetUserId: z.string().uuid(),
  accessLevel: z.enum(['employee', 'platform_admin', 'super_admin']),
  enabled: z.boolean(),
  reason: z.string().trim().min(8).max(500),
  expiresAt: z.string().datetime().nullable().optional(),
})

const internalPlanInputSchema = z.object({
  employeeUserId: z.string().uuid(),
  arenaId: z.string().uuid(),
  enabled: z.boolean(),
  reason: z.string().trim().min(8).max(500),
})

function asRpcClient(): PlatformRpcClient {
  return getSupabaseAdmin() as unknown as PlatformRpcClient
}

function firstRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function commercialStatus(
  arenaStatus: string | null,
  subscriptionStatus: string | null,
  currentPeriodEnd: string | null,
  isInternalPlan: boolean,
): PlatformArena['commercialStatus'] {
  if (['inativo', 'inactive'].includes(arenaStatus ?? '')) return 'desativada'
  if (isInternalPlan) return 'cliente_ativo'
  if (['past_due', 'unpaid', 'incomplete_expired'].includes(subscriptionStatus ?? '')) return 'inadimplente'
  if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
    if (currentPeriodEnd && new Date(currentPeriodEnd).getTime() <= Date.now()) return 'inadimplente'
    return 'cliente_ativo'
  }
  if (['canceled', 'paused'].includes(subscriptionStatus ?? '')) return 'desativada'
  return 'prospect'
}

function parseLocationPoint(location: unknown): { latitude: number; longitude: number } | null {
  if (typeof location !== 'string' || !/^[0-9a-f]+$/i.test(location) || location.length < 42) return null
  try {
    const bytes = Uint8Array.from(location.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16))
    const view = new DataView(bytes.buffer)
    const littleEndian = view.getUint8(0) === 1
    const geometryType = view.getUint32(1, littleEndian)
    const coordinatesOffset = 5 + ((geometryType & 0x20000000) !== 0 ? 4 : 0)
    const longitude = view.getFloat64(coordinatesOffset, littleEndian)
    const latitude = view.getFloat64(coordinatesOffset + 8, littleEndian)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
    return { latitude, longitude }
  } catch {
    return null
  }
}

function defaultPixSplitSettings(): ArenaPixSplitSettings {
  return {
    enabled: false,
    asaasWalletId: '',
    asaasAccountId: '',
    holderName: '',
    holderDocument: '',
    pixKey: '',
    status: 'disabled',
    platformFeeBasisPoints: 200,
    updatedAt: null,
  }
}

function normalizePixSplitStatus(status: string | null): ArenaPixSplitStatus {
  if (status === 'pending' || status === 'active' || status === 'disabled' || status === 'rejected') {
    return status
  }
  return 'disabled'
}

function mapPixSplitSettings(row: ArenaPaymentAccountRow | undefined): ArenaPixSplitSettings {
  if (!row) return defaultPixSplitSettings()
  return {
    enabled: row.status === 'active' && Boolean(row.asaas_wallet_id),
    asaasWalletId: row.asaas_wallet_id ?? '',
    asaasAccountId: row.asaas_account_id ?? '',
    holderName: row.holder_name ?? '',
    holderDocument: row.holder_document ?? '',
    pixKey: row.pix_key ?? '',
    status: normalizePixSplitStatus(row.status),
    platformFeeBasisPoints: Number(row.platform_fee_basis_points ?? 200),
    updatedAt: row.updated_at ?? null,
  }
}

export async function getPlatformAdminOverview(
  options: { includePaymentSettings?: boolean } = {},
): Promise<PlatformAdminOverview> {
  const profile = await assertPlatformAdminAccess()
  const supabase = getSupabaseAdmin()
  const rpc = asRpcClient()

  const [
    usersResult,
    arenasResult,
    municipalitiesResult,
    statesResult,
    subscriptionsResult,
    paymentAccountsResult,
    membershipsResult,
    athletesResult,
    athleteEntitlementsResult,
    arenaAthletesResult,
    courtsResult,
    bookingActivityResult,
    principalsResult,
    assignmentsResult,
    auditResult,
  ] = await Promise.all([
    supabase
      .from('users')
      .select('id, email, name, role, created_at')
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase
      .from('arenas')
      .select('id, name, status, owner_id, created_at, location, id_municipio, owner:users!arenas_owner_id_fkey(id, name, email)')
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase.from('municipios').select('codigo_ibge, nome, codigo_uf').limit(6000),
    supabase.from('estados').select('codigo_uf, uf').limit(50),
    supabase
      .from('arena_subscriptions')
      .select('arena_id, plan_key, status, current_period_end, plan:subscription_plans(label, price_cents, is_internal)')
      .limit(1000),
    profile.accessLevel === 'super_admin' && options.includePaymentSettings
      ? supabase
          .from('arena_payment_accounts')
          .select(
            'arena_id, asaas_wallet_id, asaas_account_id, holder_name, holder_document, pix_key, platform_fee_basis_points, status, updated_at',
          )
          .eq('provider', 'asaas')
          .limit(1000)
      : Promise.resolve({ data: [] as ArenaPaymentAccountRow[], error: null }),
    supabase
      .from('arena_users')
      .select('arena_id, user_id, role, status')
      .limit(5000),
    profile.accessLevel === 'super_admin'
      ? supabase
          .from('atleta')
          .select('id, id_users, nome_perfil, origem_cadastro, id_arena_cadastro, created_at, updated_at, user:users!atleta_id_users_fkey(email)')
          .order('created_at', { ascending: false })
          .limit(5000)
      : Promise.resolve({ data: [] as AthleteRow[], error: null }),
    profile.accessLevel === 'super_admin'
      ? supabase.from('athlete_app_entitlements').select('atleta_id, plan, status').limit(5000)
      : Promise.resolve({ data: [] as AthleteEntitlementRow[], error: null }),
    profile.accessLevel === 'super_admin'
      ? supabase.from('arenas_atleta').select('id_arena, id_atleta').limit(10000)
      : Promise.resolve({ data: [] as ArenaAthleteRow[], error: null }),
    profile.accessLevel === 'super_admin'
      ? supabase.from('courts').select('arena_id, status').limit(10000)
      : Promise.resolve({ data: [] as CourtRow[], error: null }),
    profile.accessLevel === 'super_admin'
      ? supabase
          .from('bookings')
          .select('arena_id, athlete_id, start_time, status')
          .eq('status', 'confirmed')
          .gte('start_time', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
          .limit(10000)
      : Promise.resolve({ data: [] as BookingActivityRow[], error: null }),
    rpc.rpc('list_platform_principals', { p_actor_user_id: profile.dbUserId }),
    rpc.rpc('list_internal_employee_plan_assignments', { p_actor_user_id: profile.dbUserId }),
    rpc.rpc('list_platform_security_audit', { p_actor_user_id: profile.dbUserId, p_limit: 100 }),
  ])

  const queryError =
    usersResult.error ??
    arenasResult.error ??
    municipalitiesResult.error ??
    statesResult.error ??
    subscriptionsResult.error ??
    paymentAccountsResult.error ??
    membershipsResult.error ??
    athletesResult.error ??
    athleteEntitlementsResult.error ??
    arenaAthletesResult.error ??
    courtsResult.error ??
    bookingActivityResult.error ??
    principalsResult.error ??
    assignmentsResult.error ??
    auditResult.error

  if (queryError) {
    throw new Error(`Falha ao carregar a administração da plataforma: ${queryError.message}`)
  }

  const subscriptions = new Map(
    ((subscriptionsResult.data ?? []) as SubscriptionRow[]).map((subscription) => [subscription.arena_id, subscription]),
  )

  const municipalities = new Map(
    ((municipalitiesResult.data ?? []) as MunicipalityRow[]).map((municipality) => [municipality.codigo_ibge, municipality]),
  )
  const states = new Map(
    ((statesResult.data ?? []) as StateRow[]).map((state) => [state.codigo_uf, state]),
  )

  const paymentAccounts = new Map(
    ((paymentAccountsResult.data ?? []) as ArenaPaymentAccountRow[]).map((account) => [account.arena_id, account]),
  )

  const users: PlatformUser[] = (usersResult.data ?? []).map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.created_at,
  }))

  const arenaAthleteRows = (arenaAthletesResult.data ?? []) as ArenaAthleteRow[]
  const courtRows = (courtsResult.data ?? []) as CourtRow[]
  const bookingRows = (bookingActivityResult.data ?? []) as BookingActivityRow[]
  const athleteEntitlements = new Map(
    ((athleteEntitlementsResult.data ?? []) as AthleteEntitlementRow[]).map((entitlement) => [entitlement.atleta_id, entitlement]),
  )
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000

  const athleteArenaIds = new Map<string, string[]>()
  const arenaAthleteCounts = new Map<string, Set<string>>()
  for (const link of arenaAthleteRows) {
    athleteArenaIds.set(link.id_atleta, [...(athleteArenaIds.get(link.id_atleta) ?? []), link.id_arena])
    const athletesForArena = arenaAthleteCounts.get(link.id_arena) ?? new Set<string>()
    athletesForArena.add(link.id_atleta)
    arenaAthleteCounts.set(link.id_arena, athletesForArena)
  }

  const activeCourtCounts = new Map<string, number>()
  for (const court of courtRows) {
    if (court.status !== 'ativo') continue
    activeCourtCounts.set(court.arena_id, (activeCourtCounts.get(court.arena_id) ?? 0) + 1)
  }

  const currentBookingCounts = new Map<string, number>()
  const previousBookingCounts = new Map<string, number>()
  const athleteBookingCounts = new Map<string, number>()
  for (const booking of bookingRows) {
    const isCurrent = new Date(booking.start_time).getTime() >= thirtyDaysAgo
    const target = isCurrent ? currentBookingCounts : previousBookingCounts
    target.set(booking.arena_id, (target.get(booking.arena_id) ?? 0) + 1)
    if (isCurrent && booking.athlete_id) {
      athleteBookingCounts.set(booking.athlete_id, (athleteBookingCounts.get(booking.athlete_id) ?? 0) + 1)
    }
  }

  const athletes: PlatformAthlete[] = ((athletesResult.data ?? []) as unknown as AthleteRow[]).map((athlete) => {
    const entitlement = athleteEntitlements.get(athlete.id)
    return {
      id: athlete.id,
      userId: athlete.id_users,
      name: athlete.nome_perfil,
      email: firstRelation(athlete.user)?.email ?? '—',
      origin: athlete.origem_cadastro,
      plan: entitlement?.plan === 'plus' && ['active', 'trialing'].includes(entitlement.status) ? 'plus' : 'free',
      planStatus: entitlement?.status ?? 'active',
      signupArenaId: athlete.id_arena_cadastro,
      linkedArenaIds: athleteArenaIds.get(athlete.id) ?? [],
      bookingsLast30Days: athleteBookingCounts.get(athlete.id) ?? 0,
      createdAt: athlete.created_at,
      updatedAt: athlete.updated_at,
    }
  })

  const arenas: PlatformArena[] = ((arenasResult.data ?? []) as unknown as ArenaRow[]).map((arena) => {
    const owner = firstRelation(arena.owner)
    const city = arena.id_municipio ? municipalities.get(arena.id_municipio) : null
    const state = city ? states.get(city.codigo_uf) : null
    const subscription = subscriptions.get(arena.id)
    const plan = subscription ? firstRelation(subscription.plan) : null
    const coordinates = parseLocationPoint(arena.location)
    return {
      id: arena.id,
      name: arena.name,
      status: arena.status,
      commercialStatus: commercialStatus(
        arena.status,
        subscription?.status ?? null,
        subscription?.current_period_end ?? null,
        Boolean(plan?.is_internal),
      ),
      ownerId: arena.owner_id,
      ownerName: owner?.name ?? null,
      ownerEmail: owner?.email ?? '—',
      cityName: city?.nome ?? null,
      stateCode: state?.uf ?? null,
      hasLocation: Boolean(arena.location),
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      createdAt: arena.created_at,
      planKey: subscription?.plan_key ?? null,
      planLabel: plan?.label ?? null,
      planPriceCents: plan?.is_internal ? 0 : Number(plan?.price_cents ?? 0),
      subscriptionStatus: subscription?.status ?? null,
      currentPeriodEnd: subscription?.current_period_end ?? null,
      athleteCount: arenaAthleteCounts.get(arena.id)?.size ?? 0,
      courtCount: activeCourtCounts.get(arena.id) ?? 0,
      bookingsLast30Days: currentBookingCounts.get(arena.id) ?? 0,
      bookingsPrevious30Days: previousBookingCounts.get(arena.id) ?? 0,
      pixSplitSettings: mapPixSplitSettings(paymentAccounts.get(arena.id)),
    }
  })

  const memberships: PlatformMembership[] = (membershipsResult.data ?? []).map((membership) => ({
    arenaId: membership.arena_id,
    userId: membership.user_id,
    role: membership.role,
    status: membership.status,
  }))

  const principals: PlatformPrincipal[] = ((principalsResult.data ?? []) as PrincipalRow[]).map((principal) => ({
    userId: principal.user_id,
    email: principal.email,
    name: principal.name,
    accessLevel: principal.access_level,
    status: principal.status,
    expiresAt: principal.expires_at,
    createdAt: principal.created_at,
    updatedAt: principal.updated_at,
  }))

  const audit: PlatformAuditEvent[] = ((auditResult.data ?? []) as AuditRow[]).map((event) => ({
    id: event.id,
    eventType: event.event_type,
    actorUserId: event.actor_user_id,
    targetUserId: event.target_user_id,
    arenaId: event.arena_id,
    reason: event.reason,
    metadata: event.metadata ?? {},
    createdAt: event.created_at,
  }))

  const internalPlanAssignments: PlatformInternalPlanAssignment[] = (
    (assignmentsResult.data ?? []) as InternalPlanAssignmentRow[]
  ).map((assignment) => ({
    arenaId: assignment.arena_id,
    employeeUserId: assignment.employee_user_id,
    grantedByUserId: assignment.granted_by_user_id,
    reason: assignment.reason,
    grantedAt: assignment.granted_at,
    updatedAt: assignment.updated_at,
  }))

  return {
    currentAccessLevel: profile.accessLevel,
    users,
    principals,
    arenas,
    athletes,
    memberships,
    internalPlanAssignments,
    audit,
  }
}

export async function managePlatformPrincipalAction(
  input: z.input<typeof principalInputSchema>,
): Promise<PlatformAdminActionResult> {
  try {
    const profile = await assertPlatformAdminAccess()
    if (profile.accessLevel !== 'super_admin') {
      return { success: false, error: 'Somente um superadmin pode alterar a equipe da plataforma.' }
    }

    const parsed = principalInputSchema.parse(input)
    const { data: principalsData, error: principalsError } = await asRpcClient().rpc('list_platform_principals', {
      p_actor_user_id: profile.dbUserId,
    })
    if (principalsError) throw new Error(principalsError.message)

    const principals = (principalsData ?? []) as PrincipalRow[]
    const activeSuperAdmins = principals.filter(
      (principal) => principal.access_level === 'super_admin' && principal.status === 'active',
    )
    const targetIsActiveSuperAdmin = activeSuperAdmins.some((principal) => principal.user_id === parsed.targetUserId)
    const removesSuperAdminContinuity =
      !parsed.enabled || parsed.accessLevel !== 'super_admin' || Boolean(parsed.expiresAt)

    if (targetIsActiveSuperAdmin && activeSuperAdmins.length === 1 && removesSuperAdminContinuity) {
      return { success: false, error: 'Não é possível remover, rebaixar ou expirar o último superadmin ativo.' }
    }

    const { error } = await asRpcClient().rpc('manage_platform_principal', {
      p_actor_user_id: profile.dbUserId,
      p_target_user_id: parsed.targetUserId,
      p_access_level: parsed.accessLevel,
      p_enabled: parsed.enabled,
      p_reason: parsed.reason,
      p_expires_at: parsed.enabled ? (parsed.expiresAt ?? null) : null,
    })

    if (error) throw new Error(error.message)
    revalidatePath('/dashboard/admin/platform')
    revalidatePath('/dashboard/admin/super-admin')
    revalidatePath('/admin/settings')
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Não foi possível alterar a equipe da plataforma.',
    }
  }
}

export async function manageInternalEmployeePlanAction(
  input: z.input<typeof internalPlanInputSchema>,
): Promise<PlatformAdminActionResult> {
  try {
    const profile = await assertPlatformSuperAdminAccess()
    const parsed = internalPlanInputSchema.parse(input)
    const { error } = await asRpcClient().rpc('manage_internal_employee_plan', {
      p_actor_user_id: profile.dbUserId,
      p_employee_user_id: parsed.employeeUserId,
      p_arena_id: parsed.arenaId,
      p_enabled: parsed.enabled,
      p_reason: parsed.reason,
    })

    if (error) throw new Error(error.message)
    revalidatePath('/dashboard/admin/platform')
    revalidatePath('/dashboard/admin/super-admin')
    revalidatePath('/admin/settings')
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Não foi possível alterar o plano interno.',
    }
  }
}
