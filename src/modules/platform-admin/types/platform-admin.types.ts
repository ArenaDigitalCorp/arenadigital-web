export type PlatformAccessLevel = 'employee' | 'platform_admin' | 'super_admin'

export type PlatformPrincipal = {
  userId: string
  email: string
  name: string | null
  accessLevel: PlatformAccessLevel
  status: 'active' | 'revoked'
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

export type PlatformUser = {
  id: string
  email: string
  name: string | null
  role: string | null
  createdAt: string
}

export type PlatformArena = {
  id: string
  name: string
  status: string | null
  ownerId: string
  ownerName: string | null
  ownerEmail: string
  createdAt: string
  planKey: string | null
  subscriptionStatus: string | null
}

export type PlatformMembership = {
  arenaId: string
  userId: string
  role: string
  status: string
}

export type PlatformAuditEvent = {
  id: number
  eventType: string
  actorUserId: string | null
  targetUserId: string | null
  arenaId: string | null
  reason: string
  metadata: Record<string, unknown>
  createdAt: string
}

export type PlatformInternalPlanAssignment = {
  arenaId: string
  employeeUserId: string
  grantedByUserId: string | null
  reason: string
  grantedAt: string
  updatedAt: string
}

export type PlatformAdminOverview = {
  currentAccessLevel: 'platform_admin' | 'super_admin'
  users: PlatformUser[]
  principals: PlatformPrincipal[]
  arenas: PlatformArena[]
  memberships: PlatformMembership[]
  internalPlanAssignments: PlatformInternalPlanAssignment[]
  audit: PlatformAuditEvent[]
}

export type PlatformAdminActionResult = {
  success: boolean
  error?: string
}
