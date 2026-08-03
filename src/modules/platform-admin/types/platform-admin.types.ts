import type { ArenaPixSplitSettings } from '@/modules/arenas/types/pix-split.types'

export type PlatformAccessLevel = 'employee' | 'platform_admin' | 'super_admin'
export type PlatformArenaKind = 'customer' | 'public_listing' | 'demo'

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
  platformKind: PlatformArenaKind
  appDiscoverable: boolean
  platformNotes: string | null
  commercialStatus: 'cliente_ativo' | 'inadimplente' | 'prospect' | 'desativada'
  ownerId: string | null
  ownerName: string | null
  ownerEmail: string
  registrationEmail: string
  registrationPhone: string
  registrationDocument: string
  registrationAddress: string
  registrationAddressNumber: string
  registrationComplement: string
  registrationProvince: string
  registrationPostalCode: string
  cityName: string | null
  stateCode: string | null
  hasLocation: boolean
  latitude: number | null
  longitude: number | null
  createdAt: string
  planKey: string | null
  planLabel: string | null
  planPriceCents: number
  subscriptionStatus: string | null
  currentPeriodEnd: string | null
  athleteCount: number
  courtCount: number
  bookingsLast30Days: number
  bookingsPrevious30Days: number
  pixSplitSettings: ArenaPixSplitSettings
}

export type PlatformAthlete = {
  id: string
  userId: string
  name: string
  email: string
  origin: string
  plan: 'free' | 'plus'
  planStatus: string
  signupArenaId: string | null
  linkedArenaIds: string[]
  bookingsLast30Days: number
  createdAt: string
  updatedAt: string
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
  athletes: PlatformAthlete[]
  memberships: PlatformMembership[]
  internalPlanAssignments: PlatformInternalPlanAssignment[]
  audit: PlatformAuditEvent[]
}

export type PlatformAdminActionResult = {
  success: boolean
  error?: string
}
