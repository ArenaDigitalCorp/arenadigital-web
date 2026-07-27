'use server'

import { assertArenaBackofficeAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import type { ArenaNotification, ArenaNotificationType } from '@/modules/notifications/types/notification.types'

const NOTIFICATION_COLUMNS =
  'id, arena_id, type, title, body, payload, entity_type, entity_id, atleta_id, read_at, created_at'

interface ListOptions {
  limit?: number
  /** Retorna apenas as não lidas. */
  onlyUnread?: boolean
  types?: ArenaNotificationType[]
}

export async function getArenaNotificationsAction(
  arenaId: string,
  options: ListOptions = {}
): Promise<{ success: boolean; data?: ArenaNotification[]; unreadCount?: number; error?: string }> {
  try {
    await assertArenaBackofficeAccess(arenaId)
    const supabase = getSupabaseAdmin()

    let query = supabase
      .from('arena_notifications')
      .select(NOTIFICATION_COLUMNS)
      .eq('arena_id', arenaId)
      .order('created_at', { ascending: false })
      .limit(options.limit ?? 30)

    if (options.onlyUnread) query = query.is('read_at', null)
    if (options.types?.length) query = query.in('type', options.types)

    const [listResult, countResult] = await Promise.all([
      query,
      supabase
        .from('arena_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('arena_id', arenaId)
        .is('read_at', null),
    ])

    if (listResult.error) throw new Error(listResult.error.message)
    if (countResult.error) throw new Error(countResult.error.message)

    return {
      success: true,
      data: (listResult.data ?? []) as unknown as ArenaNotification[],
      unreadCount: countResult.count ?? 0,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao carregar notificações'
    return { success: false, error: message }
  }
}

export async function markNotificationReadAction(
  arenaId: string,
  notificationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertArenaBackofficeAccess(arenaId)
    const supabase = getSupabaseAdmin()

    const { error } = await supabase
      .from('arena_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('arena_id', arenaId)
      .is('read_at', null)

    if (error) throw new Error(error.message)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao marcar notificação como lida'
    return { success: false, error: message }
  }
}

export async function markAllNotificationsReadAction(
  arenaId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertArenaBackofficeAccess(arenaId)
    const supabase = getSupabaseAdmin()

    const { error } = await supabase
      .from('arena_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('arena_id', arenaId)
      .is('read_at', null)

    if (error) throw new Error(error.message)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao marcar notificações como lidas'
    return { success: false, error: message }
  }
}
