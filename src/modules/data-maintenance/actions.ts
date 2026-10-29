'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertPlatformSuperAdminAccess, AuthorizationError } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { fetchAllSupabaseRows } from '@/lib/supabase-pagination'
import { cleanupPreviewSchema, cleanupExecuteSchema, cleanupRestoreSchema, cleanupOperationSchema, cleanupHistoryCursorSchema } from './schema'
import type { CleanupArena, CleanupOperation, CleanupResult } from './types'

function failure(error: unknown, restoring = false): { success: false; error: string; unavailable?: boolean } {
  if (error instanceof z.ZodError) return { success: false, error: error.issues[0]?.message ?? 'Confira os dados informados.' }
  if (error instanceof AuthorizationError) return { success: false, error: 'Acesso exclusivo de superadmin ativo.' }
  const value = error && typeof error === 'object' ? error as { code?: string; message?: string } : {}
  if (['PGRST202','42883'].includes(value.code ?? '')) return { success: false, unavailable: true, error: 'A manutenção de dados aguarda a atualização do banco neste ambiente.' }
  if (['55P03','40P01','57014'].includes(value.code ?? '')) return { success: false, error: restoring ? 'A arena está em uso. Aguarde e tente restaurar novamente.' : 'A arena está em uso. Aguarde e gere uma nova prévia.' }
  if (value.code === '23503') return { success: false, error: 'Há vínculos que impedem esta operação. Nenhum dado foi alterado.' }
  if (value.code === '23505') return { success: false, error: 'Há registros ou caixa aberto em conflito. Nenhum dado foi sobrescrito.' }
  if (value.code === '23P01') return { success: false, error: 'Há horários ocupados ou outros registros em conflito com a restauração. Nenhum dado foi sobrescrito.' }
  if (value.code === '40001') return { success: false, error: restoring ? 'Não foi possível restaurar os registros exatamente como estavam. Nenhum dado foi alterado.' : 'Os dados mudaram desde a prévia. Gere uma nova prévia antes de continuar.' }
  if (value.code === '42501' && value.message === 'A operacao nao pertence a arena selecionada.') return { success: false, error: 'Confira a arena selecionada e atualize os dados da tela.' }
  if (value.code === '42501') return { success: false, error: 'Sua conta não está autorizada para esta operação.' }
  if (['22023','P0002'].includes(value.code ?? '')) return { success: false, error: value.message ?? 'Revise a operação e tente novamente.' }
  return { success: false, error: 'Não foi possível concluir a operação. Confira o histórico antes de tentar novamente.' }
}

export async function getCleanupArenas(): Promise<CleanupResult<CleanupArena[]>> {
  try {
    await assertPlatformSuperAdminAccess()
    const { data, error } = await fetchAllSupabaseRows(getSupabaseAdmin().from('arenas')
      .select('id,name,cpf_cnpj,platform_kind').in('platform_kind',['customer','demo']).order('name').order('id'))
    if (error) throw error
    return { success: true, data: (data ?? []).map(arena => ({id:arena.id,name:arena.name,document:arena.cpf_cnpj,kind:arena.platform_kind})) }
  } catch (error) { return failure(error) }
}

export async function previewArenaCleanup(input: unknown): Promise<CleanupResult<CleanupOperation>> {
  try {
    const actor = await assertPlatformSuperAdminAccess()
    const parsed = cleanupPreviewSchema.parse(input)
    const { data, error } = await getSupabaseAdmin().rpc('preview_arena_data_cleanup', {
      p_actor_user_id: actor.dbUserId, p_arena_id: parsed.arenaId, p_modules: parsed.modules,
      p_reason: parsed.reason, p_cutoff: parsed.cutoff,
    })
    if (error) throw error
    return { success: true, data: cleanupOperationSchema.parse(data) }
  } catch (error) { return failure(error) }
}

function invalidateArena(arenaId: string) {
  // The database operation is already committed; cache failure cannot turn it
  // into a false failure that encourages a second destructive request.
  for (const path of ['/admin/maintenance','/admin/overview','/admin/finance',
    `/dashboard/finance/${arenaId}`,`/dashboard/reports/${arenaId}`,`/dashboard/athletes/${arenaId}`,
    `/dashboard/arenas/${arenaId}`,`/dashboard/rotativo/${arenaId}`,`/dashboard/turmas/${arenaId}`,
    `/dashboard/loyalty/${arenaId}`,`/dashboard/settings/products/${arenaId}`,`/dashboard/settings/users/${arenaId}`]) {
    try { revalidatePath(path, 'layout') } catch { /* The history remains authoritative. */ }
  }
}

export async function executeArenaCleanup(input: unknown): Promise<CleanupResult<CleanupOperation>> {
  try {
    const actor = await assertPlatformSuperAdminAccess()
    const parsed = cleanupExecuteSchema.parse(input)
    const { data, error } = await getSupabaseAdmin().rpc('execute_arena_data_cleanup', {
      p_actor_user_id: actor.dbUserId, p_arena_id: parsed.arenaId, p_operation_id: parsed.operationId,
      p_confirmation_name: parsed.confirmationName, p_confirm_test_data: parsed.confirmTestData,
    })
    if (error) throw error
    const operation = cleanupOperationSchema.parse(data)
    invalidateArena(operation.arenaId)
    return { success: true, data: operation }
  } catch (error) { return failure(error) }
}

export async function restoreArenaCleanup(input: unknown): Promise<CleanupResult<CleanupOperation>> {
  try {
    const actor = await assertPlatformSuperAdminAccess()
    const parsed = cleanupRestoreSchema.parse(input)
    const { data, error } = await getSupabaseAdmin().rpc('restore_arena_data_cleanup', {
      p_actor_user_id: actor.dbUserId, p_arena_id: parsed.arenaId, p_operation_id: parsed.operationId,
      p_confirmation_name: parsed.confirmationName, p_reason: parsed.reason,
    })
    if (error) throw error
    const operation = cleanupOperationSchema.parse(data)
    invalidateArena(operation.arenaId)
    return { success: true, data: operation }
  } catch (error) { return failure(error, true) }
}

export async function listArenaCleanups(arenaId: unknown, cursorInput: unknown = null): Promise<CleanupResult<CleanupOperation[]>> {
  try {
    const actor = await assertPlatformSuperAdminAccess()
    const id = z.string().uuid().parse(arenaId)
    const cursor = cleanupHistoryCursorSchema.parse(cursorInput)
    const { data, error } = await getSupabaseAdmin().rpc('list_arena_data_cleanups', {p_actor_user_id:actor.dbUserId,p_arena_id:id,p_before_created_at:cursor?.createdAt ?? null,p_before_id:cursor?.id ?? null})
    if (error) throw error
    return { success: true, data: z.array(cleanupOperationSchema).parse(data) }
  } catch (error) { return failure(error) }
}
