'use server'

import { getSupabaseAdmin } from '@/lib/supabase-server'
import {
  assertArenaBackofficeAccess,
  requireAuthenticatedDbUser,
} from '@/lib/server-auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  PERFIS_ATLETA,
  type PerfilAtleta,
  type PerfilAtletaEstado,
} from '@/modules/athletes/types/perfil.types'

const uuid = z.string().uuid()

/* eslint-disable @typescript-eslint/no-explicit-any -- RPCs fora dos tipos gerados */
type LooseClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>
  ) => Promise<{ data: any; error: { message: string } | null }>
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function parseEstado(row: Record<string, unknown>): PerfilAtletaEstado {
  const papeis = Array.isArray(row.papeis_detectados)
    ? (row.papeis_detectados as PerfilAtleta[])
    : (['padrao'] as PerfilAtleta[])
  return {
    papeisDetectados: papeis,
    perfilSugerido: (row.perfil_sugerido as PerfilAtleta) ?? 'padrao',
    perfilDefinido: (row.perfil_definido as PerfilAtleta | null) ?? null,
    perfilEfetivo: (row.perfil_efetivo as PerfilAtleta) ?? 'padrao',
    definidoManualmente: Boolean(row.definido_manualmente),
    definidoEm: (row.definido_em as string | null) ?? null,
  }
}

export async function getPerfilAtletaAction(
  arenaId: string,
  atletaId: string
): Promise<{ success: boolean; data?: PerfilAtletaEstado; error?: string }> {
  try {
    await assertArenaBackofficeAccess(arenaId)
    const parsed = z.object({ arenaId: uuid, atletaId: uuid }).parse({ arenaId, atletaId })

    const { data, error } = await (getSupabaseAdmin() as unknown as LooseClient).rpc(
      'get_atleta_perfil',
      { p_arena_id: parsed.arenaId, p_atleta_id: parsed.atletaId }
    )
    if (error) throw new Error(error.message)

    return { success: true, data: parseEstado((data ?? {}) as Record<string, unknown>) }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao carregar o perfil do atleta'
    return { success: false, error: message }
  }
}

const setPerfilSchema = z.object({
  arenaId: uuid,
  atletaId: uuid,
  /** `null` devolve o atleta ao perfil sugerido pelo sistema. */
  perfil: z.enum(PERFIS_ATLETA).nullable(),
})

export async function setPerfilAtletaAction(
  input: unknown
): Promise<{ success: boolean; data?: PerfilAtletaEstado; error?: string }> {
  try {
    const parsed = setPerfilSchema.parse(input)
    await assertArenaBackofficeAccess(parsed.arenaId)
    const { dbUserId } = await requireAuthenticatedDbUser()

    const { data, error } = await (getSupabaseAdmin() as unknown as LooseClient).rpc(
      'set_atleta_perfil_atomic',
      {
        p_arena_id: parsed.arenaId,
        p_atleta_id: parsed.atletaId,
        p_perfil: parsed.perfil,
        p_registered_by: dbUserId,
      }
    )
    if (error) throw new Error(error.message)

    revalidatePath(`/dashboard/athletes/${parsed.arenaId}/${parsed.atletaId}`)
    revalidatePath(`/dashboard/athletes/${parsed.arenaId}`)
    return { success: true, data: parseEstado((data ?? {}) as Record<string, unknown>) }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao definir o perfil do atleta'
    return { success: false, error: message }
  }
}

/**
 * Perfil de todos os atletas da arena, numa chamada. A listagem carrega a arena
 * inteira e filtra no cliente; buscar perfil por linha seria N+1.
 */
export async function listPerfisAtletaAction(
  arenaId: string
): Promise<{ success: boolean; data?: Record<string, PerfilAtleta>; error?: string }> {
  try {
    await assertArenaBackofficeAccess(arenaId)
    const parsed = z.object({ arenaId: uuid }).parse({ arenaId })

    const { data, error } = await (getSupabaseAdmin() as unknown as LooseClient).rpc(
      'list_atleta_perfis',
      { p_arena_id: parsed.arenaId }
    )
    if (error) throw new Error(error.message)

    const mapa: Record<string, PerfilAtleta> = {}
    for (const linha of (data ?? []) as { atleta_id: string; perfil_efetivo: string }[]) {
      mapa[linha.atleta_id] = (linha.perfil_efetivo as PerfilAtleta) ?? 'padrao'
    }
    return { success: true, data: mapa }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao carregar os perfis'
    return { success: false, error: message }
  }
}
