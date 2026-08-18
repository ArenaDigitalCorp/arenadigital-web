"use server"

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getLocationPointFromAddress } from '@/lib/geocoding'
import { observeServerAction } from '@/lib/observability/server'
import { assertPlatformAdminAccess, assertPlatformSuperAdminAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { ensureExperimentalSubscription } from '@/modules/payments/usecases/ensure-experimental-subscription.usecase'
import type { ArenaPixSplitSettings, ArenaPixSplitStatus } from '@/modules/arenas/types/pix-split.types'
import { getArenaCommercialStatus } from '@/modules/platform-admin/lib/commercial-status'
import {
  normalizePublicArenaImportBatch,
  normalizePublicArenaImportBatchList,
} from '@/modules/platform-admin/lib/public-arena-import-result'
import {
  applyPublicArenaImportBatchInputSchema,
  claimPublicArenaAsCustomerInputSchema,
  discoverOpenStreetMapArenasInputSchema,
  listPublicArenaImportBatchesInputSchema,
  publicArenaImportBatchIdSchema,
  reviewArenaClaimRequestInputSchema,
  searchEligibleArenaOwnersInputSchema,
  stagePublicArenaImportBatchInputSchema,
  type ApplyPublicArenaImportBatchInput,
  type ClaimPublicArenaAsCustomerInput,
  type DiscoverOpenStreetMapArenasInput,
  type StagePublicArenaImportBatchInput,
  type ReviewArenaClaimRequestInput,
} from '@/modules/platform-admin/schemas/public-arena-import.schema'
import {
  publicArenaListingInputSchema,
  type ParsedPublicArenaListingInput,
  type PublicArenaListingInput,
} from '@/modules/platform-admin/schemas/public-arena-listing.schema'
import type {
  CreatePublicArenaListingResult,
  OpenStreetMapArenaDiscoveryResult,
  PlatformAccessLevel,
  PlatformAdminActionResult,
  PlatformAdminOverview,
  PlatformArenaClaimRequest,
  PlatformArena,
  PlatformArenaKind,
  PlatformAthlete,
  PlatformAuditEvent,
  PlatformInternalPlanAssignment,
  PlatformMembership,
  PlatformPrincipal,
  PlatformReferenceMunicipality,
  PlatformEligibleOwnerSearchResult,
  PlatformUser,
  PublicArenaImportBatchListResult,
  PublicArenaImportBatchResult,
  PublicArenaImportDraft,
  PublicArenaListingFormOptions,
} from '@/modules/platform-admin/types/platform-admin.types'

type PlatformRpcClient = {
  rpc: (
    name:
      | 'list_platform_principals'
      | 'list_platform_security_audit'
      | 'list_platform_arena_metadata'
      | 'list_internal_employee_plan_assignments'
      | 'manage_platform_principal'
      | 'manage_internal_employee_plan'
      | 'manage_platform_arena_profile'
      | 'create_public_arena_listing'
      | 'stage_public_arena_import_batch'
      | 'get_public_arena_import_batch'
      | 'list_public_arena_import_batches'
      | 'apply_public_arena_import_batch'
      | 'claim_public_arena_as_customer'
      | 'list_arena_claim_requests'
      | 'review_arena_claim_request',
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>
}

type ArenaRow = {
  id: string
  name: string
  status: string | null
  platform_kind: PlatformArenaKind | null
  app_discoverable: boolean | null
  owner_id: string | null
  created_at: string
  owner: { id: string; name: string | null; email: string } | { id: string; name: string | null; email: string }[] | null
  email: string | null
  phone: string | null
  cpf_cnpj: string | null
  address: unknown
  number: string | null
  complement: string | null
  neighborhood: string | null
  zip_code: string | null
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
type StateRow = { codigo_uf: number; nome?: string; uf: string }
type ArenaPlatformMetadataRow = { arena_id: string; platform_notes: string | null; updated_at: string }
type ArenaClaimRequestRow = {
  id: string
  requester_user_id: string
  requester_name: string | null
  requester_email: string
  arena_id: string | null
  arena_name: string | null
  municipality_name: string | null
  request_kind: PlatformArenaClaimRequest['requestKind']
  status: PlatformArenaClaimRequest['status']
  submitted_arena_name: string
  created_at: string
  reviewed_at: string | null
  review_reason: string | null
}

type ArenaPaymentAccountRow = {
  arena_id: string
  asaas_wallet_id: string | null
  asaas_account_id: string | null
  holder_name: string | null
  holder_document: string | null
  pix_key: string | null
  platform_fee_basis_points: number | null
  status: string | null
  payment_flow: string | null
  onboarding_status: string | null
  commercial_info_status: string | null
  bank_account_info_status: string | null
  documentation_status: string | null
  onboarding_url: string | null
  last_status_checked_at: string | null
  activated_at: string | null
  webhook_token_hash: string | null
  credential_recovery_pending: boolean | null
  metadata: unknown
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

const platformArenaProfileInputSchema = z.object({
  arenaId: z.string().uuid(),
  platformKind: z.enum(['customer', 'public_listing', 'demo']),
  appDiscoverable: z.boolean(),
  platformNotes: z.string().trim().max(1000).nullable().optional(),
  reason: z.string().trim().min(8).max(500),
}).superRefine((input, ctx) => {
  if (input.platformKind === 'demo' && input.appDiscoverable) {
    ctx.addIssue({
      code: 'custom',
      path: ['appDiscoverable'],
      message: 'Arena demo não pode aparecer na busca pública do app.',
    })
  }
})

function asRpcClient(): PlatformRpcClient {
  return getSupabaseAdmin() as unknown as PlatformRpcClient
}

function firstRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value
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
    hasPaymentAccount: false,
    onboardingStarted: false,
    webhookConfigured: false,
    credentialRecoveryRequired: false,
    paymentFlow: 'arena_subaccount_split',
    asaasWalletId: '',
    asaasAccountId: '',
    holderName: '',
    holderDocument: '',
    pixKey: '',
    status: 'disabled',
    onboardingStatus: 'NOT_STARTED',
    commercialInfoStatus: 'NOT_STARTED',
    bankAccountInfoStatus: 'NOT_STARTED',
    documentationStatus: 'NOT_STARTED',
    onboardingUrl: null,
    lastStatusCheckedAt: null,
    activatedAt: null,
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
  const onboardingStatus = normalizeAsaasOnboardingStatus(row.onboarding_status)
  const onboardingStarted = onboardingStatus !== 'NOT_STARTED'
  const paymentFlow = 'arena_subaccount_split' as const
  const webhookConfigured = Boolean(row.webhook_token_hash)
  const credentialRecoveryRequired =
    row.credential_recovery_pending === true || (onboardingStarted && !row.asaas_account_id)
  return {
    enabled:
      row.status === 'active' &&
      Boolean(row.asaas_wallet_id) &&
      onboardingStatus === 'APPROVED' && webhookConfigured,
    hasPaymentAccount: true,
    onboardingStarted,
    webhookConfigured,
    credentialRecoveryRequired,
    paymentFlow,
    asaasWalletId: row.asaas_wallet_id ?? '',
    asaasAccountId: row.asaas_account_id ?? '',
    holderName: row.holder_name ?? '',
    holderDocument: row.holder_document ?? '',
    pixKey: row.pix_key ?? '',
    status: normalizePixSplitStatus(row.status),
    onboardingStatus,
    commercialInfoStatus: normalizeAsaasOnboardingStatus(row.commercial_info_status),
    bankAccountInfoStatus: normalizeAsaasOnboardingStatus(row.bank_account_info_status),
    documentationStatus: normalizeAsaasOnboardingStatus(row.documentation_status),
    onboardingUrl: safeHttpsUrl(row.onboarding_url),
    lastStatusCheckedAt: row.last_status_checked_at ?? null,
    activatedAt: row.activated_at ?? null,
    platformFeeBasisPoints: Number(row.platform_fee_basis_points ?? 200),
    updatedAt: row.updated_at ?? null,
  }
}

function normalizeAsaasOnboardingStatus(
  status: string | null,
): ArenaPixSplitSettings['onboardingStatus'] {
  const normalized = status?.toUpperCase()
  if (
    normalized === 'PENDING' ||
    normalized === 'AWAITING_APPROVAL' ||
    normalized === 'APPROVED' ||
    normalized === 'REJECTED'
  ) {
    return normalized
  }
  return 'NOT_STARTED'
}

function safeHttpsUrl(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function addressText(value: unknown): string {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  for (const key of ['street', 'address', 'logradouro']) {
    const candidate = (value as Record<string, unknown>)[key]
    if (typeof candidate === 'string') return candidate
  }
  return ''
}

type PublicArenaLocationResolution = {
  wkt: string | null
  precision: 'address' | 'municipality' | 'unavailable'
}

async function resolvePublicArenaLocation(
  input: ParsedPublicArenaListingInput,
): Promise<PublicArenaLocationResolution> {
  const supabase = getSupabaseAdmin()
  const { data: municipality, error: municipalityError } = await supabase
    .from('municipios')
    .select('nome, codigo_uf, latitude, longitude')
    .eq('codigo_ibge', input.municipalityId)
    .maybeSingle()

  if (municipalityError) throw new Error(municipalityError.message)
  if (!municipality || municipality.codigo_uf !== input.stateCode) {
    throw new Error('O município selecionado não pertence ao estado informado.')
  }

  const { data: state, error: stateError } = await supabase
    .from('estados')
    .select('uf')
    .eq('codigo_uf', input.stateCode)
    .maybeSingle()

  if (stateError) throw new Error(stateError.message)
  if (!state) throw new Error('Estado não encontrado.')

  const point = await getLocationPointFromAddress({
    street: input.address,
    number: input.number,
    neighborhood: input.neighborhood,
    city: municipality.nome,
    state: state.uf,
  })
  if (point) return { wkt: point, precision: 'address' }

  if (municipality.latitude != null && municipality.longitude != null) {
    return {
      wkt: `POINT(${municipality.longitude} ${municipality.latitude})`,
      precision: 'municipality',
    }
  }
  return { wkt: null, precision: 'unavailable' }
}

export async function getPublicArenaListingFormOptionsAction(): Promise<{
  success: boolean
  data?: PublicArenaListingFormOptions
  error?: string
}> {
  try {
    await assertPlatformSuperAdminAccess()
    const supabase = getSupabaseAdmin()
    const [statesResult, sportsResult] = await Promise.all([
      supabase.from('estados').select('codigo_uf, nome, uf').order('nome'),
      supabase.from('sports').select('id, name').order('name'),
    ])

    const queryError = statesResult.error ?? sportsResult.error
    if (queryError) throw new Error(queryError.message)

    return {
      success: true,
      data: {
        states: (statesResult.data ?? []).map((state) => ({
          code: state.codigo_uf,
          name: state.nome,
          uf: state.uf,
        })),
        sports: (sportsResult.data ?? []).map((sport) => ({ id: sport.id, name: sport.name })),
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Não foi possível carregar os dados do formulário.',
    }
  }
}

export async function getPublicArenaMunicipalitiesAction(codigoUf: number): Promise<{
  success: boolean
  data: PlatformReferenceMunicipality[]
  error?: string
}> {
  try {
    await assertPlatformSuperAdminAccess()
    const parsedStateCode = z.number().int().positive().parse(codigoUf)
    const { data, error } = await getSupabaseAdmin()
      .from('municipios')
      .select('codigo_ibge, nome')
      .eq('codigo_uf', parsedStateCode)
      .order('nome')

    if (error) throw new Error(error.message)
    return {
      success: true,
      data: (data ?? []).map((municipality) => ({
        code: municipality.codigo_ibge,
        name: municipality.nome,
      })),
    }
  } catch (error) {
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Não foi possível carregar os municípios.',
    }
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
    arenaMetadataResult,
    arenaClaimRequestsResult,
  ] = await Promise.all([
    supabase
      .from('users')
      .select('id, email, name, role, auth_user_id, created_at')
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase
      .from('arenas')
      .select('id, name, status, platform_kind, app_discoverable, owner_id, created_at, location, id_municipio, email, phone, cpf_cnpj, address, number, complement, neighborhood, zip_code, owner:users!arenas_owner_id_fkey(id, name, email)')
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
            'arena_id, asaas_wallet_id, asaas_account_id, holder_name, holder_document, pix_key, platform_fee_basis_points, status, payment_flow, onboarding_status, commercial_info_status, bank_account_info_status, documentation_status, onboarding_url, last_status_checked_at, activated_at, webhook_token_hash, credential_recovery_pending, metadata, updated_at',
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
    rpc.rpc('list_platform_arena_metadata', { p_actor_user_id: profile.dbUserId }),
    profile.accessLevel === 'super_admin'
      ? rpc.rpc('list_arena_claim_requests', {
          p_actor_user_id: profile.dbUserId,
          p_status: null,
          p_limit: 100,
        })
      : Promise.resolve({ data: [] as ArenaClaimRequestRow[], error: null }),
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
    auditResult.error ??
    arenaMetadataResult.error ??
    arenaClaimRequestsResult.error

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
  const arenaMetadata = new Map(
    ((arenaMetadataResult.data ?? []) as ArenaPlatformMetadataRow[]).map((metadata) => [metadata.arena_id, metadata]),
  )

  const users: PlatformUser[] = (usersResult.data ?? []).map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    hasAuthIdentity: Boolean(user.auth_user_id),
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
      platformKind: arena.platform_kind ?? 'customer',
      appDiscoverable: arena.app_discoverable ?? false,
      platformNotes: arenaMetadata.get(arena.id)?.platform_notes ?? null,
      commercialStatus: getArenaCommercialStatus({
        platformKind: arena.platform_kind ?? 'customer',
        arenaStatus: arena.status,
        subscriptionStatus: subscription?.status ?? null,
        currentPeriodEnd: subscription?.current_period_end ?? null,
        isInternalPlan: Boolean(plan?.is_internal),
      }),
      ownerId: arena.owner_id,
      ownerName: owner?.name ?? null,
      ownerEmail: owner?.email ?? '—',
      registrationEmail: arena.email ?? owner?.email ?? '',
      registrationPhone: arena.phone ?? '',
      registrationDocument: arena.cpf_cnpj ?? '',
      registrationAddress: addressText(arena.address),
      registrationAddressNumber: arena.number ?? '',
      registrationComplement: arena.complement ?? '',
      registrationProvince: arena.neighborhood ?? '',
      registrationPostalCode: arena.zip_code ?? '',
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

  const arenaClaimRequests: PlatformArenaClaimRequest[] = (
    (arenaClaimRequestsResult.data ?? []) as ArenaClaimRequestRow[]
  ).map((request) => ({
    id: request.id,
    requesterUserId: request.requester_user_id,
    requesterName: request.requester_name,
    requesterEmail: request.requester_email,
    arenaId: request.arena_id,
    arenaName: request.arena_name,
    municipalityName: request.municipality_name,
    requestKind: request.request_kind,
    status: request.status,
    submittedArenaName: request.submitted_arena_name,
    createdAt: request.created_at,
    reviewedAt: request.reviewed_at,
    reviewReason: request.review_reason,
  }))

  return {
    currentAccessLevel: profile.accessLevel,
    users,
    principals,
    arenas,
    athletes,
    memberships,
    arenaClaimRequests,
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

export async function updatePlatformArenaProfileAction(
  input: z.input<typeof platformArenaProfileInputSchema>,
): Promise<PlatformAdminActionResult> {
  try {
    const profile = await assertPlatformSuperAdminAccess()
    const parsed = platformArenaProfileInputSchema.parse(input)
    const { error } = await asRpcClient().rpc('manage_platform_arena_profile', {
      p_actor_user_id: profile.dbUserId,
      p_arena_id: parsed.arenaId,
      p_platform_kind: parsed.platformKind,
      p_app_discoverable: parsed.appDiscoverable,
      p_platform_notes: parsed.platformNotes?.trim() || null,
      p_reason: parsed.reason,
    })
    if (error) throw new Error(error.message)

    revalidatePath('/admin/arenas')
    revalidatePath(`/admin/arenas/${parsed.arenaId}`)
    revalidatePath('/admin/overview')
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Não foi possível atualizar a classificação da arena.',
    }
  }
}

export async function createPublicArenaListingAction(
  input: PublicArenaListingInput,
): Promise<CreatePublicArenaListingResult> {
  const observer = await observeServerAction({
    component: 'platform_admin',
    operation: 'create_public_arena_listing',
  })

  try {
    const profile = await assertPlatformSuperAdminAccess()
    const parsed = publicArenaListingInputSchema.parse(input)
    const location = await resolvePublicArenaLocation(parsed)
    const { data, error } = await asRpcClient().rpc('create_public_arena_listing', {
      p_actor_user_id: profile.dbUserId,
      p_name: parsed.name,
      p_id_municipio: parsed.municipalityId,
      p_address: parsed.address,
      p_number: parsed.number?.trim() || null,
      p_complement: parsed.complement?.trim() || null,
      p_neighborhood: parsed.neighborhood?.trim() || null,
      p_zip_code: parsed.zipCode || null,
      p_phone: parsed.phone?.trim() || null,
      p_email: parsed.email?.trim().toLowerCase() || null,
      p_cnpj: parsed.cnpj || null,
      p_description: parsed.description?.trim() || null,
      p_location_wkt: location.wkt,
      p_sport_ids: [...new Set(parsed.sportIds)],
      p_source: 'manual',
      p_external_id: null,
      p_platform_notes: parsed.platformNotes?.trim() || null,
      p_reason: parsed.reason,
    })

    if (error) throw new Error(error.message)
    const arenaId = z.string().uuid().parse(data)

    revalidatePath('/admin')
    revalidatePath('/admin/overview')
    revalidatePath('/admin/arenas')
    revalidatePath(`/admin/arenas/${arenaId}`)
    revalidatePath('/dashboard/admin/platform')
    revalidatePath('/dashboard/admin/super-admin')
    observer.complete('completed', {
      arena_id: arenaId,
      source: 'manual',
      sport_count: parsed.sportIds.length,
      location_precision: location.precision,
    })
    return { success: true, arenaId }
  } catch (error) {
    observer.complete('failed', {
      error_type: error instanceof z.ZodError ? 'validation' : 'operation',
    })
    return {
      success: false,
      error:
        error instanceof z.ZodError
          ? (error.issues[0]?.message ?? 'Revise os dados informados.')
          : error instanceof Error
            ? error.message
            : 'Não foi possível criar o local público.',
    }
  }
}

function revalidatePublicArenaCatalogPaths(arenaId?: string) {
  revalidatePath('/admin')
  revalidatePath('/admin/overview')
  revalidatePath('/admin/arenas')
  revalidatePath('/dashboard/admin/platform')
  revalidatePath('/dashboard/admin/super-admin')
  if (arenaId) revalidatePath(`/admin/arenas/${arenaId}`)
}

export async function stagePublicArenaImportBatchAction(
  input: StagePublicArenaImportBatchInput,
): Promise<PublicArenaImportBatchResult> {
  const observer = await observeServerAction({ component: 'platform_admin', operation: 'stage_public_arena_import_batch' })
  try {
    const profile = await assertPlatformSuperAdminAccess()
    const parsed = stagePublicArenaImportBatchInputSchema.parse(input)
    const { data, error } = await asRpcClient().rpc('stage_public_arena_import_batch', {
      p_actor_user_id: profile.dbUserId,
      p_operation_id: parsed.operationId,
      p_source: parsed.source,
      p_filename: parsed.filename?.trim() || `${parsed.source}-importacao`,
      p_items: parsed.items,
      p_reason: parsed.reason,
    })
    if (error) throw new Error(error.message)
    const batch = normalizePublicArenaImportBatch(data)
    observer.complete('completed', {
      batch_id: batch.id,
      source: batch.source,
      total_count: batch.counts.total,
      ready_count: batch.counts.ready,
      duplicate_count: batch.counts.duplicate,
      invalid_count: batch.counts.invalid,
    })
    return { success: true, batch }
  } catch (error) {
    observer.complete('failed', { error_type: error instanceof z.ZodError ? 'validation' : 'operation' })
    return { success: false, error: error instanceof Error ? error.message : 'Não foi possível validar o lote de arenas.' }
  }
}

export async function getPublicArenaImportBatchAction(batchId: string): Promise<PublicArenaImportBatchResult> {
  try {
    const profile = await assertPlatformSuperAdminAccess()
    const parsedBatchId = publicArenaImportBatchIdSchema.parse(batchId)
    const { data, error } = await asRpcClient().rpc('get_public_arena_import_batch', {
      p_actor_user_id: profile.dbUserId,
      p_batch_id: parsedBatchId,
    })
    if (error) throw new Error(error.message)
    return { success: true, batch: normalizePublicArenaImportBatch(data) }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Não foi possível carregar o lote de arenas.' }
  }
}

export async function listPublicArenaImportBatchesAction(limit = 20): Promise<PublicArenaImportBatchListResult> {
  try {
    const profile = await assertPlatformSuperAdminAccess()
    const parsedLimit = listPublicArenaImportBatchesInputSchema.parse(limit)
    const { data, error } = await asRpcClient().rpc('list_public_arena_import_batches', {
      p_actor_user_id: profile.dbUserId,
      p_limit: parsedLimit,
    })
    if (error) throw new Error(error.message)
    return { success: true, batches: normalizePublicArenaImportBatchList(data) }
  } catch (error) {
    return { success: false, batches: [], error: error instanceof Error ? error.message : 'Não foi possível listar os lotes de arenas.' }
  }
}

export async function applyPublicArenaImportBatchAction(
  input: ApplyPublicArenaImportBatchInput,
): Promise<PublicArenaImportBatchResult> {
  const observer = await observeServerAction({ component: 'platform_admin', operation: 'apply_public_arena_import_batch' })
  try {
    const profile = await assertPlatformSuperAdminAccess()
    const parsed = applyPublicArenaImportBatchInputSchema.parse(input)
    const uniqueItemIds = [...new Set(parsed.itemIds)]
    if (uniqueItemIds.length !== parsed.itemIds.length) throw new Error('A seleção contém linhas repetidas.')
    const { data, error } = await asRpcClient().rpc('apply_public_arena_import_batch', {
      p_actor_user_id: profile.dbUserId,
      p_batch_id: parsed.batchId,
      p_item_ids: uniqueItemIds,
      p_reason: parsed.reason,
    })
    if (error) throw new Error(error.message)
    const batch = normalizePublicArenaImportBatch(data)
    revalidatePublicArenaCatalogPaths()
    observer.complete('completed', {
      batch_id: batch.id,
      source: batch.source,
      selected_count: uniqueItemIds.length,
      applied_count: batch.counts.applied,
      remaining_ready_count: batch.counts.ready,
    })
    return { success: true, batch }
  } catch (error) {
    observer.complete('failed', { error_type: error instanceof z.ZodError ? 'validation' : 'operation' })
    return { success: false, error: error instanceof Error ? error.message : 'Não foi possível aplicar o lote de arenas.' }
  }
}

export async function claimPublicArenaAsCustomerAction(
  input: ClaimPublicArenaAsCustomerInput,
): Promise<PlatformAdminActionResult> {
  const observer = await observeServerAction({ component: 'platform_admin', operation: 'claim_public_arena_as_customer' })
  try {
    const profile = await assertPlatformSuperAdminAccess()
    const parsed = claimPublicArenaAsCustomerInputSchema.parse(input)
    const { error } = await asRpcClient().rpc('claim_public_arena_as_customer', {
      p_actor_user_id: profile.dbUserId,
      p_arena_id: parsed.arenaId,
      p_owner_user_id: parsed.ownerUserId,
      p_reason: parsed.reason,
      p_keep_discoverable: parsed.keepDiscoverable,
    })
    if (error) throw new Error(error.message)
    revalidatePublicArenaCatalogPaths(parsed.arenaId)
    observer.complete('completed', { arena_id: parsed.arenaId, keep_discoverable: parsed.keepDiscoverable })
    return { success: true }
  } catch (error) {
    observer.complete('failed', { error_type: error instanceof z.ZodError ? 'validation' : 'operation' })
    return { success: false, error: error instanceof Error ? error.message : 'Não foi possível converter o local em cliente.' }
  }
}

export async function reviewArenaClaimRequestAction(
  input: ReviewArenaClaimRequestInput,
): Promise<PlatformAdminActionResult> {
  const observer = await observeServerAction({
    component: 'platform_admin',
    operation: 'review_arena_claim_request',
  })

  try {
    const profile = await assertPlatformSuperAdminAccess()
    const parsed = reviewArenaClaimRequestInputSchema.parse(input)
    const { data, error } = await asRpcClient().rpc('review_arena_claim_request', {
      p_actor_user_id: profile.dbUserId,
      p_request_id: parsed.requestId,
      p_decision: parsed.decision,
      p_reason: parsed.reason,
      p_keep_discoverable: parsed.keepDiscoverable,
    })
    if (error) throw new Error(error.message)

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('A revisão retornou um resultado inválido.')
    }

    const result = data as Record<string, unknown>
    const arenaId = typeof result.arena_id === 'string' ? result.arena_id : null
    const requesterUserId = typeof result.requester_user_id === 'string' ? result.requester_user_id : null
    if (parsed.decision === 'approve') {
      if (!arenaId || !requesterUserId) throw new Error('A arena aprovada não pôde ser identificada.')
      const trial = await ensureExperimentalSubscription({ arenaId, actorId: requesterUserId })
      if (!trial.created && trial.reason === 'plan_not_found') {
        throw new Error('O vínculo foi aprovado, mas o plano experimental não está disponível. Tente novamente após corrigir o catálogo de planos.')
      }
    }

    revalidatePath('/admin/arenas')
    revalidatePath('/admin/overview')
    revalidatePath('/sign-up/status')
    if (arenaId) revalidatePath(`/admin/arenas/${arenaId}`)
    observer.complete('completed', {
      request_id: parsed.requestId,
      decision: parsed.decision,
      arena_id: arenaId,
      keep_discoverable: parsed.keepDiscoverable,
    })
    return { success: true }
  } catch (error) {
    observer.complete('failed', { error_type: error instanceof z.ZodError ? 'validation' : 'operation' })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Não foi possível revisar a solicitação.',
    }
  }
}

export async function searchEligibleArenaOwnersAction(query: string): Promise<PlatformEligibleOwnerSearchResult> {
  try {
    await assertPlatformSuperAdminAccess()
    const term = searchEligibleArenaOwnersInputSchema.parse(query)
    let ownerQuery = getSupabaseAdmin()
      .from('users')
      .select('id, name, email, role')
      .not('auth_user_id', 'is', null)
      .neq('role', 'atleta')
      .order('name', { ascending: true })
      .limit(20)
    ownerQuery = term.includes('@')
      ? ownerQuery.ilike('email', `%${term}%`)
      : ownerQuery.ilike('name', `%${term}%`)
    const { data, error } = await ownerQuery
    if (error) throw new Error(error.message)
    return {
      success: true,
      users: (data ?? []).map((user) => ({ id: user.id, name: user.name, email: user.email, role: user.role })),
    }
  } catch (error) {
    return { success: false, users: [], error: error instanceof Error ? error.message : 'Não foi possível buscar contas proprietárias.' }
  }
}

type OpenStreetMapElement = {
  type?: unknown
  id?: unknown
  lat?: unknown
  lon?: unknown
  center?: { lat?: unknown; lon?: unknown }
  tags?: Record<string, unknown>
}

function osmText(tags: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = tags[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

export async function discoverOpenStreetMapArenasAction(
  input: DiscoverOpenStreetMapArenasInput,
): Promise<OpenStreetMapArenaDiscoveryResult> {
  const observer = await observeServerAction({ component: 'platform_admin', operation: 'discover_openstreetmap_arenas' })
  try {
    await assertPlatformSuperAdminAccess()
    const parsed = discoverOpenStreetMapArenasInputSchema.parse(input)
    const supabase = getSupabaseAdmin()
    const [{ data: municipality, error: municipalityError }, { data: sports, error: sportsError }] = await Promise.all([
      supabase.from('municipios').select('codigo_ibge, nome, codigo_uf').eq('codigo_ibge', parsed.municipalityId).maybeSingle(),
      supabase.from('sports').select('id').in('id', parsed.sportIds),
    ])
    if (municipalityError) throw new Error(municipalityError.message)
    if (sportsError) throw new Error(sportsError.message)
    if (!municipality || municipality.codigo_uf !== parsed.stateCode) throw new Error('O município não pertence ao estado selecionado.')
    if ((sports ?? []).length !== new Set(parsed.sportIds).size) throw new Error('Um ou mais esportes selecionados não existem.')

    const overpassQuery = `[out:json][timeout:15];
area["boundary"="administrative"]["IBGE:GEOCODIGO"="${parsed.municipalityId}"]->.searchArea;
(
  nwr["leisure"~"^(sports_centre|pitch|stadium)$"](area.searchArea);
);
out center 200;`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20_000)
    let response: Response
    try {
      response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': 'ArenaDigital-Web-Admin/1.0',
        },
        body: new URLSearchParams({ data: overpassQuery }),
        cache: 'no-store',
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }
    if (response.status === 429 || response.status === 504) throw new Error('O OpenStreetMap está ocupado agora. Aguarde alguns minutos e tente novamente.')
    if (!response.ok) throw new Error('Não foi possível consultar o OpenStreetMap para este município.')
    const rawText = await response.text()
    if (rawText.length > 2_000_000) throw new Error('A consulta retornou dados demais. Restrinja o município.')
    const raw = JSON.parse(rawText) as { elements?: OpenStreetMapElement[] }
    const seen = new Set<string>()
    const items: PublicArenaImportDraft[] = []
    for (const element of raw.elements ?? []) {
      if (items.length >= 200) break
      const type = typeof element.type === 'string' ? element.type : ''
      const id = typeof element.id === 'number' || typeof element.id === 'string' ? String(element.id) : ''
      const tags = element.tags && typeof element.tags === 'object' ? element.tags : {}
      const name = osmText(tags, 'name', 'operator', 'brand')
      const latitude = Number(element.lat ?? element.center?.lat)
      const longitude = Number(element.lon ?? element.center?.lon)
      const externalId = `osm:${type}/${id}`
      if (!type || !id || !name || !Number.isFinite(latitude) || !Number.isFinite(longitude) || seen.has(externalId)) continue
      seen.add(externalId)
      items.push({
        external_id: externalId,
        name,
        cnpj: null,
        address: osmText(tags, 'addr:street', 'addr:place', 'addr:full') ?? municipality.nome,
        number: osmText(tags, 'addr:housenumber'),
        complement: null,
        neighborhood: osmText(tags, 'addr:suburb', 'addr:neighbourhood'),
        zip_code: osmText(tags, 'addr:postcode'),
        phone: osmText(tags, 'contact:phone', 'phone'),
        email: osmText(tags, 'contact:email', 'email'),
        description: osmText(tags, 'description', 'sport'),
        municipality_id: parsed.municipalityId,
        sport_ids: [...new Set(parsed.sportIds)],
        latitude,
        longitude,
        platform_notes: 'Origem OpenStreetMap; revisar dados antes de publicar no aplicativo.',
      })
    }
    observer.complete('completed', { source: 'openstreetmap', municipality_id: parsed.municipalityId, result_count: items.length })
    return { success: true, items, count: items.length }
  } catch (error) {
    observer.complete('failed', { error_type: error instanceof z.ZodError ? 'validation' : 'operation' })
    return { success: false, error: error instanceof Error ? error.message : 'Não foi possível consultar o OpenStreetMap.' }
  }
}
