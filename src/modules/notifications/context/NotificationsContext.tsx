'use client'

import { createContext, useCallback, useContext, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  useArenaNotificationsFeed,
  type ArenaNotificationsFeed,
} from '@/modules/notifications/hooks/useArenaNotificationsFeed'
import {
  notificationTargetPath,
  type ArenaNotification,
} from '@/modules/notifications/types/notification.types'
import { useArena } from '@/contexts/ArenaContext'

interface NotificationsContextValue extends ArenaNotificationsFeed {
  arenaId: string
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined)

/** Avisos da arena selecionada, compartilhados pelo sino e pelo toast global. */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { selectedArena } = useArena()
  const router = useRouter()

  const handleNew = useCallback(
    (notification: ArenaNotification) => {
      toast(notification.title, {
        description: notification.body ?? undefined,
        duration: 8000,
        classNames: {
          toast: 'border-slate-200',
          title: '!text-arena-navy-800 !font-bold',
          description: '!text-arena-navy-800/70 !font-medium',
          actionButton:
            '!bg-arena-button !text-white !font-bold hover:!bg-arena-button-hover',
        },
        action: {
          label: 'Ver',
          onClick: () => router.push(notificationTargetPath(notification)),
        },
      })
    },
    [router]
  )

  const feed = useArenaNotificationsFeed(selectedArena || null, {
    limit: 20,
    onNewNotification: handleNew,
  })

  const value = useMemo<NotificationsContextValue>(
    () => ({ ...feed, arenaId: selectedArena }),
    [feed, selectedArena]
  )

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  )
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    throw new Error('useNotifications deve ser usado dentro de NotificationsProvider')
  }
  return ctx
}
