'use server'

import { revalidatePath } from 'next/cache'
import { assertArenaOwnerAccess } from '@/lib/server-auth'
import { accessRpc } from './server'
import type { ProfileInput } from './types'

export async function saveAccessProfile(arenaId: string, input: ProfileInput) {
  try {
    await assertArenaOwnerAccess(arenaId)
    const id = await accessRpc('save_arena_access_profile', {
      p_arena_id: arenaId, p_profile_id: input.id, p_name: input.name.trim(),
      p_base_role: input.baseRole, p_resources: input.resources, p_expected_version: input.version,
    })
    revalidatePath('/dashboard', 'layout')
    return { success: true as const, id }
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Não foi possível salvar o perfil.' }
  }
}

export async function archiveAccessProfile(arenaId: string, profileId: string, version: number) {
  try {
    await assertArenaOwnerAccess(arenaId)
    await accessRpc('archive_arena_access_profile', { p_arena_id: arenaId, p_profile_id: profileId, p_expected_version: version })
    revalidatePath('/dashboard', 'layout')
    return { success: true as const }
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Não foi possível arquivar o perfil.' }
  }
}
