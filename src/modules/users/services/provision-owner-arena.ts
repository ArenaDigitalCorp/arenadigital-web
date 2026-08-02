import 'server-only'

import { onlyDigits } from '@/lib/brasil-document'
import { getLocationPointFromAddress } from '@/lib/geocoding'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { ensureExperimentalSubscription } from '@/modules/payments/usecases/ensure-experimental-subscription.usecase'
import type { Database } from '@/types/supabase.types'

type OwnerArenaAddressData = {
  cep?: string
  state?: string
  city?: string
  id_municipio?: number
  neighborhood?: string
  street?: string
  number?: string
  complement?: string
}

type ArenaInsert = Database['public']['Tables']['arenas']['Insert']

function normalizeOwnerArenaAddressData(value: unknown): OwnerArenaAddressData | undefined {
  if (!value || typeof value !== 'object') return undefined
  const input = value as Record<string, unknown>

  return {
    cep: typeof input.cep === 'string' ? input.cep : undefined,
    state: typeof input.state === 'string' ? input.state : undefined,
    city: typeof input.city === 'string' ? input.city : undefined,
    id_municipio: typeof input.id_municipio === 'number' ? input.id_municipio : undefined,
    neighborhood: typeof input.neighborhood === 'string' ? input.neighborhood : undefined,
    street: typeof input.street === 'string' ? input.street : undefined,
    number: typeof input.number === 'string' ? input.number : undefined,
    complement: typeof input.complement === 'string' ? input.complement : undefined,
  }
}

async function ensureOwnerArenaUserLink(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  arenaId: string,
  ownerId: string,
) {
  const { data: existingLink } = await supabase
    .from('arena_users')
    .select('id')
    .eq('arena_id', arenaId)
    .eq('user_id', ownerId)
    .maybeSingle()

  if (existingLink) return

  const { error: arenaUserError } = await supabase.from('arena_users').insert({
    arena_id: arenaId,
    user_id: ownerId,
    role: 'Gestor',
    status: 'Ativo',
  })
  if (arenaUserError && arenaUserError.code !== '23505') {
    throw new Error(`Erro ao vincular usuário: ${arenaUserError.message}`)
  }
}

/**
 * Internal-only, idempotent provisioning primitive. This module is deliberately
 * not a Server Action; callers must authenticate and authorize the owner first.
 */
export async function provisionOwnerArena(
  ownerId: string,
  arenaName: string,
  phone?: string,
  addressData?: unknown,
  arenaDocument?: string,
): Promise<string | null> {
  const supabase = getSupabaseAdmin()
  const arenaAddress = normalizeOwnerArenaAddressData(addressData)
  const normalizedArenaName = arenaName.trim()

  const { data: ownerArenas, error: ownerArenasError } = await supabase
    .from('arenas')
    .select('id, name')
    .eq('owner_id', ownerId)
  if (ownerArenasError) throw new Error(`Erro ao verificar arena existente: ${ownerArenasError.message}`)

  const existingArena = ownerArenas?.find(
    (arena) => arena.name.trim().toLocaleLowerCase('pt-BR') === normalizedArenaName.toLocaleLowerCase('pt-BR'),
  )

  if (existingArena) {
    await ensureOwnerArenaUserLink(supabase, existingArena.id, ownerId)
    await ensureExperimentalSubscription({ arenaId: existingArena.id, actorId: ownerId })
    return existingArena.id
  }

  const cleanArenaDocument = onlyDigits(arenaDocument)
  const arenaInsertData: ArenaInsert = {
    name: normalizedArenaName,
    owner_id: ownerId,
    status: 'ativo',
    ...(phone && { phone }),
    ...(cleanArenaDocument && { cpf_cnpj: cleanArenaDocument }),
  }

  if (arenaAddress) {
    arenaInsertData.zip_code = arenaAddress.cep || undefined
    arenaInsertData.id_municipio = arenaAddress.id_municipio || undefined
    arenaInsertData.number = arenaAddress.number || undefined
    arenaInsertData.complement = arenaAddress.complement || undefined
    arenaInsertData.neighborhood = arenaAddress.neighborhood || undefined
    arenaInsertData.address = arenaAddress.street || undefined

    if (arenaAddress.street && arenaAddress.city && arenaAddress.state) {
      const locationPoint = await getLocationPointFromAddress({
        street: arenaAddress.street,
        number: arenaAddress.number || '',
        neighborhood: arenaAddress.neighborhood || '',
        city: arenaAddress.city,
        state: arenaAddress.state,
      })
      if (locationPoint) arenaInsertData.location = locationPoint
    }
  }

  const { data: newArena, error: arenaError } = await supabase
    .from('arenas')
    .insert(arenaInsertData)
    .select()
    .single()

  if (arenaError && arenaError.code !== '23505') {
    throw new Error(`Erro ao criar arena: ${arenaError.message}`)
  }

  if (newArena) {
    await ensureOwnerArenaUserLink(supabase, newArena.id, ownerId)
    await ensureExperimentalSubscription({ arenaId: newArena.id, actorId: ownerId })
    return newArena.id
  }

  // Outra tentativa pode ter vencido a corrida protegida pelo índice único.
  // Releia e finalize as partes idempotentes antes de consumir o signup intent.
  const { data: concurrentArenas, error: concurrentArenaError } = await supabase
    .from('arenas')
    .select('id, name')
    .eq('owner_id', ownerId)
  if (concurrentArenaError) {
    throw new Error(`Erro ao reconciliar arena criada: ${concurrentArenaError.message}`)
  }
  const concurrentArena = concurrentArenas?.find(
    (arena) => arena.name.trim().toLocaleLowerCase('pt-BR') === normalizedArenaName.toLocaleLowerCase('pt-BR'),
  )
  if (!concurrentArena) throw new Error('A arena não foi criada nem encontrada após a tentativa de provisionamento.')

  await ensureOwnerArenaUserLink(supabase, concurrentArena.id, ownerId)
  await ensureExperimentalSubscription({ arenaId: concurrentArena.id, actorId: ownerId })
  return concurrentArena.id
}
