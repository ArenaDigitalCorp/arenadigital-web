import 'server-only'

import { getLocationPointFromAddress } from '@/lib/geocoding'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { ensureExperimentalSubscription } from '@/modules/payments/usecases/ensure-experimental-subscription.usecase'
import type { ArenaSignupAddress } from '@/modules/auth/lib/arena-signup-intent'

export type SelfServiceArenaSignupStatus =
  | 'provisioned'
  | 'claim_pending'
  | 'access_conflict'
  | 'rejected'
  | 'none'

export type SelfServiceArenaSignupResult = {
  status: SelfServiceArenaSignupStatus
  arenaId: string | null
  requestId: string | null
  arenaName: string | null
  municipalityName: string | null
  arenaCreated: boolean
}

type SignupRpcClient = {
  rpc: (
    name: 'resolve_self_service_arena_signup' | 'get_self_service_arena_signup_status',
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>
}

function asSignupRpcClient(): SignupRpcClient {
  return getSupabaseAdmin() as unknown as SignupRpcClient
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function normalizeSignupResult(value: unknown): SelfServiceArenaSignupResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Resposta inválida ao resolver o cadastro da arena.')
  }

  const result = value as Record<string, unknown>
  const status = result.status
  if (!['provisioned', 'claim_pending', 'access_conflict', 'rejected', 'none'].includes(String(status))) {
    throw new Error('Estado inválido ao resolver o cadastro da arena.')
  }

  return {
    status: status as SelfServiceArenaSignupStatus,
    arenaId: nullableString(result.arena_id),
    requestId: nullableString(result.request_id),
    arenaName: nullableString(result.arena_name),
    municipalityName: nullableString(result.municipality_name),
    arenaCreated: result.arena_created === true,
  }
}

async function enrichAddressWithLocation(addressData: ArenaSignupAddress) {
  if (!addressData.street || !addressData.city || !addressData.state) return { ...addressData }

  const locationWkt = await getLocationPointFromAddress({
    street: addressData.street,
    number: addressData.number,
    neighborhood: addressData.neighborhood,
    city: addressData.city,
    state: addressData.state,
  })

  return {
    ...addressData,
    ...(locationWkt ? { location_wkt: locationWkt } : {}),
  }
}

/**
 * Resolve a identidade comercial antes de criar um tenant. O banco serializa
 * por operação/documento e decide entre criação, reivindicação ou conflito.
 */
export async function resolveSelfServiceArenaSignup(input: {
  requesterUserId: string
  operationId: string
  arenaName: string
  phone: string
  document: string
  addressData: ArenaSignupAddress
}): Promise<SelfServiceArenaSignupResult> {
  const addressData = await enrichAddressWithLocation(input.addressData)
  const { data, error } = await asSignupRpcClient().rpc('resolve_self_service_arena_signup', {
    p_requester_user_id: input.requesterUserId,
    p_operation_id: input.operationId,
    p_arena_name: input.arenaName,
    p_phone: input.phone,
    p_document: input.document,
    p_address_data: addressData,
  })

  if (error) throw new Error(`Não foi possível resolver o cadastro da arena: ${error.message}`)

  const result = normalizeSignupResult(data)
  if (result.status === 'provisioned' && result.arenaId) {
    const trial = await ensureExperimentalSubscription({ arenaId: result.arenaId, actorId: input.requesterUserId })
    if (!trial.created && trial.reason === 'plan_not_found') {
      throw new Error('O plano experimental não está disponível. Tente novamente em instantes.')
    }
  }

  return result
}

export async function getSelfServiceArenaSignupStatus(
  requesterUserId: string,
): Promise<SelfServiceArenaSignupResult> {
  const { data, error } = await asSignupRpcClient().rpc('get_self_service_arena_signup_status', {
    p_requester_user_id: requesterUserId,
  })

  if (error) throw new Error(`Não foi possível consultar o cadastro da arena: ${error.message}`)
  return normalizeSignupResult(data)
}
