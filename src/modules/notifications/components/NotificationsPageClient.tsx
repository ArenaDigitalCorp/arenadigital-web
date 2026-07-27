'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DashboardPage, DashboardPageHeader } from '@/components/dashboard/DashboardPageShell'
import { DashboardTabs } from '@/components/dashboard/DashboardTabs'
import { cn } from '@/lib/utils'
import { useArenaNotificationsFeed } from '@/modules/notifications/hooks/useArenaNotificationsFeed'
import { NotificationItem } from '@/modules/notifications/components/NotificationItem'
import {
  ARENA_NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABEL,
  notificationTargetPath,
  type ArenaNotification,
  type ArenaNotificationType,
} from '@/modules/notifications/types/notification.types'

type Filter = 'todas' | 'nao_lidas' | ArenaNotificationType

const FILTERS: { label: string; value: Filter }[] = [
  { label: 'Todas', value: 'todas' },
  { label: 'Não lidas', value: 'nao_lidas' },
  ...ARENA_NOTIFICATION_TYPES.map((type) => ({
    label: NOTIFICATION_TYPE_LABEL[type],
    value: type as Filter,
  })),
]

interface Props {
  arenaId: string
  arenaName: string
  initialNotifications: ArenaNotification[]
}

export function NotificationsPageClient({ arenaId, arenaName, initialNotifications }: Props) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('todas')

  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } =
    useArenaNotificationsFeed(arenaId, { limit: 100, initialNotifications })

  const visible = useMemo(() => {
    if (filter === 'todas') return notifications
    if (filter === 'nao_lidas') return notifications.filter((n) => !n.read_at)
    return notifications.filter((n) => n.type === filter)
  }, [notifications, filter])

  const handleOpen = (notification: ArenaNotification) => {
    markAsRead(notification.id)
    router.push(notificationTargetPath(notification))
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={Bell}
        title="Notificações"
        description={`Eventos registrados pelos atletas no app em ${arenaName}.`}
        actions={
          <Button
            onClick={() => markAllAsRead()}
            disabled={unreadCount === 0}
            className="h-10 gap-2 rounded-md bg-arena-button px-4 text-sm font-bold text-white shadow-none hover:bg-arena-button-hover disabled:opacity-40"
          >
            <CheckCheck className="size-4" />
            Marcar todas como lidas
          </Button>
        }
      />

      <DashboardTabs
        value={filter}
        onChange={setFilter}
        tabs={FILTERS}
      />

      <Card className="rounded-lg border border-slate-100 bg-white px-2 py-2 shadow-sm">
        {isLoading && notifications.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-20">
            <Loader2 className="size-5 animate-spin text-arena-navy-800/40" />
            <span className="text-sm font-medium text-arena-navy-800/60">
              Carregando notificações...
            </span>
          </div>
        ) : visible.length === 0 ? (
          <div className="py-20 text-center">
            <Bell className="mx-auto mb-3 size-10 text-arena-navy-800/15" />
            <p className="font-medium text-arena-navy-800/40">
              {filter === 'todas'
                ? 'Nenhuma notificação recebida ainda.'
                : 'Nenhuma notificação neste filtro.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visible.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onClick={() => handleOpen(notification)}
              />
            ))}
          </div>
        )}
      </Card>

      <p className={cn('text-xs font-medium text-arena-navy-800/40')}>
        Os avisos chegam em tempo real conforme os atletas usam o aplicativo.
      </p>
    </DashboardPage>
  )
}
