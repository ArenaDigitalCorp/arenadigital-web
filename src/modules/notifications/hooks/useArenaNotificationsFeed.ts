'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import {
  getArenaNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '@/modules/notifications/actions/notificationActions'
import {
  isArenaNotificationType,
  type ArenaNotification,
} from '@/modules/notifications/types/notification.types'

/** Sem Realtime habilitado no projeto, a lista ainda atualiza por este intervalo. */
const POLL_INTERVAL_MS = 60_000
const DEFAULT_LIMIT = 30

interface Options {
  limit?: number
  initialNotifications?: ArenaNotification[]
  /** Disparado quando um aviso novo chega (usado para o toast global). */
  onNewNotification?: (notification: ArenaNotification) => void
}

export interface ArenaNotificationsFeed {
  notifications: ArenaNotification[]
  unreadCount: number
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
}

function normalize(row: Record<string, unknown>): ArenaNotification | null {
  const type = String(row.type ?? '')
  if (!isArenaNotificationType(type)) return null
  return {
    id: String(row.id),
    arena_id: String(row.arena_id),
    type,
    title: String(row.title ?? ''),
    body: (row.body as string | null) ?? null,
    payload: (row.payload as Record<string, unknown>) ?? {},
    entity_type: (row.entity_type as string | null) ?? null,
    entity_id: (row.entity_id as string | null) ?? null,
    atleta_id: (row.atleta_id as string | null) ?? null,
    read_at: (row.read_at as string | null) ?? null,
    created_at: String(row.created_at),
  }
}

export function useArenaNotificationsFeed(
  arenaId: string | null | undefined,
  { limit = DEFAULT_LIMIT, initialNotifications, onNewNotification }: Options = {}
): ArenaNotificationsFeed {
  const [notifications, setNotifications] = useState<ArenaNotification[]>(
    initialNotifications ?? []
  )
  const [unreadCount, setUnreadCount] = useState(
    () => (initialNotifications ?? []).filter((n) => !n.read_at).length
  )
  const [error, setError] = useState<string | null>(null)
  /** Última arena cujo carregamento terminou — usada para derivar o loading. */
  const [loadedArenaId, setLoadedArenaId] = useState<string | null>(
    initialNotifications ? (arenaId ?? null) : null
  )
  const [reloadToken, setReloadToken] = useState(0)

  // Tópico exclusivo por instância do hook. O client do Supabase reaproveita o canal
  // pelo nome do tópico, e registrar `postgres_changes` em um canal já inscrito
  // (ex.: o sino e a página abertos ao mesmo tempo) dispara
  // "cannot add postgres_changes callbacks after subscribe()".
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, '')

  // Mantém o callback atualizado sem recriar a assinatura de realtime
  const onNewRef = useRef(onNewNotification)
  useEffect(() => {
    onNewRef.current = onNewNotification
  }, [onNewNotification])

  const refresh = useCallback(async () => {
    setReloadToken((token) => token + 1)
  }, [])

  useEffect(() => {
    if (!arenaId) return
    let cancelled = false

    const load = async () => {
      const res = await getArenaNotificationsAction(arenaId, { limit })
      if (cancelled) return

      if (!res.success) {
        setError(res.error ?? 'Erro ao carregar notificações')
        setLoadedArenaId(arenaId)
        return
      }
      setError(null)
      setNotifications(res.data ?? [])
      setUnreadCount(res.unreadCount ?? 0)
      setLoadedArenaId(arenaId)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [arenaId, limit, reloadToken])

  const isLoading = Boolean(arenaId) && loadedArenaId !== arenaId

  // ── Realtime ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!arenaId) return

    let supabase
    try {
      supabase = createSupabaseBrowserClient()
    } catch {
      return // sem env de Supabase no cliente: fica só com o polling
    }

    const channel = supabase
      .channel(`arena-notifications:${arenaId}:${instanceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'arena_notifications',
          filter: `arena_id=eq.${arenaId}`,
        },
        (payload) => {
          const incoming = normalize(payload.new as Record<string, unknown>)
          if (!incoming) return
          setNotifications((prev) => {
            if (prev.some((n) => n.id === incoming.id)) return prev
            return [incoming, ...prev].slice(0, limit)
          })
          setUnreadCount((prev) => prev + 1)
          onNewRef.current?.(incoming)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'arena_notifications',
          filter: `arena_id=eq.${arenaId}`,
        },
        (payload) => {
          const updated = normalize(payload.new as Record<string, unknown>)
          if (!updated) return
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n))
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [arenaId, limit, instanceId])

  // ── Fallback por polling (também recupera avisos perdidos offline) ──────
  useEffect(() => {
    if (!arenaId) return
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      refresh()
    }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [arenaId, refresh])

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!arenaId) return
      const target = notifications.find((n) => n.id === notificationId)
      if (!target || target.read_at) return

      const now = new Date().toISOString()
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read_at: now } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))

      const res = await markNotificationReadAction(arenaId, notificationId)
      if (!res.success) refresh()
    },
    [arenaId, notifications, refresh]
  )

  const markAllAsRead = useCallback(async () => {
    if (!arenaId) return
    const now = new Date().toISOString()
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })))
    setUnreadCount(0)

    const res = await markAllNotificationsReadAction(arenaId)
    if (!res.success) refresh()
  }, [arenaId, refresh])

  return { notifications, unreadCount, isLoading, error, refresh, markAsRead, markAllAsRead }
}
