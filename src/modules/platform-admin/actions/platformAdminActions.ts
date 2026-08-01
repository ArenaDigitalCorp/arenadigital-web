"use server"

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertPlatformAdminAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import type {
  PlatformAccessLevel,
  PlatformAdminActionResult,
  PlatformAdminOverview,
  PlatformArena,
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
  owner_id: string
  created_at: string
  owner: { id: string; name: string | null; email: string } | { id: string; name: string | null; email: string }[] | null
}

type SubscriptionRow = {
  arena_id: string
  plan_key: string
  status: string
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

export async function getPlatformAdminOverview(): Promise<PlatformAdminOverview> {
  const profile = await assertPlatformAdminAccess()
  const supabase = getSupabaseAdmin()
  const rpc = asRpcClient()

  const [usersResult, arenasResult, subscriptionsResult, membershipsResult, principalsResult, assignmentsResult, auditResult] = await Promise.all([
    supabase
      .from('users')
      .select('id, email, name, role, created_at')
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase
      .from('arenas')
      .select('id, name, status, owner_id, created_at, owner:users!arenas_owner_id_fkey(id, name, email)')
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase
      .from('arena_subscriptions')
      .select('arena_id, plan_key, status')
      .limit(1000),
    supabase
      .from('arena_users')
      .select('arena_id, user_id, role, status')
      .limit(5000),
    rpc.rpc('list_platform_principals', { p_actor_user_id: profile.dbUserId }),
    rpc.rpc('list_internal_employee_plan_assignments', { p_actor_user_id: profile.dbUserId }),
    rpc.rpc('list_platform_security_audit', { p_actor_user_id: profile.dbUserId, p_limit: 100 }),
  ])

  const queryError =
    usersResult.error ??
    arenasResult.error ??
    subscriptionsResult.error ??
    membershipsResult.error ??
    principalsResult.error ??
    assignmentsResult.error ??
    auditResult.error

  if (queryError) {
    throw new Error(`Falha ao carregar a administração da plataforma: ${queryError.message}`)
  }

  const subscriptions = new Map(
    ((subscriptionsResult.data ?? []) as SubscriptionRow[]).map((subscription) => [subscription.arena_id, subscription]),
  )

  const users: PlatformUser[] = (usersResult.data ?? []).map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.created_at,
  }))

  const arenas: PlatformArena[] = ((arenasResult.data ?? []) as unknown as ArenaRow[]).map((arena) => {
    const owner = firstRelation(arena.owner)
    const subscription = subscriptions.get(arena.id)
    return {
      id: arena.id,
      name: arena.name,
      status: arena.status,
      ownerId: arena.owner_id,
      ownerName: owner?.name ?? null,
      ownerEmail: owner?.email ?? '—',
      createdAt: arena.created_at,
      planKey: subscription?.plan_key ?? null,
      subscriptionStatus: subscription?.status ?? null,
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
    const profile = await assertPlatformAdminAccess()
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
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Não foi possível alterar o plano interno.',
    }
  }
}
