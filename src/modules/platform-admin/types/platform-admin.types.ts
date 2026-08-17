import type { ArenaPixSplitSettings } from '@/modules/arenas/types/pix-split.types'

export type PlatformAccessLevel = 'employee' | 'platform_admin' | 'super_admin'
export type PlatformArenaKind = 'customer' | 'public_listing' | 'demo'
export type PlatformCommercialStatus =
  | 'cliente_ativo'
  | 'inadimplente'
  | 'prospect'
  | 'desativada'
  | 'catalogo_publico'
  | 'demonstracao'

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
  hasAuthIdentity: boolean
  createdAt: string
}

export type PlatformArena = {
  id: string
  name: string
  status: string | null
  platformKind: PlatformArenaKind
  appDiscoverable: boolean
  platformNotes: string | null
  commercialStatus: PlatformCommercialStatus
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

export type PlatformReferenceState = {
  code: number
  name: string
  uf: string
}

export type PlatformReferenceMunicipality = {
  code: number
  name: string
}

export type PlatformReferenceSport = {
  id: string
  name: string
}

export type PublicArenaListingFormOptions = {
  states: PlatformReferenceState[]
  sports: PlatformReferenceSport[]
}

export type CreatePublicArenaListingResult = PlatformAdminActionResult & {
  arenaId?: string
}

export type PublicArenaImportSource = 'csv' | 'openstreetmap' | 'receita_cnpj' | 'brasilapi'
export type PublicArenaImportItemStatus = 'ready' | 'duplicate' | 'invalid' | 'applied'

export type PublicArenaImportDraft = {
  external_id: string | null
  name: string
  cnpj: string | null
  address: string
  number: string | null
  complement: string | null
  neighborhood: string | null
  zip_code: string | null
  phone: string | null
  email: string | null
  description: string | null
  municipality_id: number | string | null
  sport_ids: string[]
  latitude: number | string | null
  longitude: number | string | null
  platform_notes: string | null
}

export type PublicArenaImportPreviewRow = {
  rowNumber: number
  item: PublicArenaImportDraft
  errors: string[]
}

export type PublicArenaImportItem = PublicArenaImportDraft & {
  id: string
  rowNumber: number
  status: PublicArenaImportItemStatus
  errors: string[]
  arenaId: string | null
}

export type PublicArenaImportCounts = {
  total: number
  ready: number
  duplicate: number
  invalid: number
  applied: number
}

export type PublicArenaImportBatch = {
  id: string
  operationId: string
  source: PublicArenaImportSource
  filename: string | null
  status: string
  counts: PublicArenaImportCounts
  items: PublicArenaImportItem[]
  createdAt: string | null
  updatedAt: string | null
}

export type PublicArenaImportBatchSummary = Omit<PublicArenaImportBatch, 'items'>

export type PublicArenaImportBatchResult = PlatformAdminActionResult & {
  batch?: PublicArenaImportBatch
}

export type PublicArenaImportBatchListResult = PlatformAdminActionResult & {
  batches: PublicArenaImportBatchSummary[]
}

export type OpenStreetMapArenaDiscoveryResult = PlatformAdminActionResult & {
  items?: PublicArenaImportDraft[]
  count?: number
}

export type PlatformEligibleOwner = {
  id: string
  name: string | null
  email: string
  role: string | null
}

export type PlatformEligibleOwnerSearchResult = PlatformAdminActionResult & {
  users: PlatformEligibleOwner[]
}
