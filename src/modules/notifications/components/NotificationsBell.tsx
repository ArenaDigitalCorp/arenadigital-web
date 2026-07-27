'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/modules/notifications/context/NotificationsContext'
import { NotificationItem } from '@/modules/notifications/components/NotificationItem'
import {
  notificationTargetPath,
  type ArenaNotification,
} from '@/modules/notifications/types/notification.types'

interface Props {
  /** Sidebar recolhida: o sino vira só ícone empilhado. */
  isCollapsed?: boolean
  className?: string
}

export function NotificationsBell({ isCollapsed = false, className }: Props) {
  const { arenaId, notifications, unreadCount, isLoading, markAsRead, markAllAsRead } =
    useNotifications()
  const [open, setOpen] = useState(false)
  const router = useRouter()

  if (!arenaId) return null

  const handleOpenNotification = (notification: ArenaNotification) => {
    setOpen(false)
    markAsRead(notification.id)
    router.push(notificationTargetPath(notification))
  }

  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={
            unreadCount > 0 ? `Notificações (${unreadCount} não lidas)` : 'Notificações'
          }
          className={cn(
            'relative cursor-pointer text-white/50 hover:bg-white/10 hover:text-white',
            isCollapsed && 'h-10 w-10 shrink-0 rounded-md',
            className
          )}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-arena-button px-1 text-[9px] font-black leading-4 text-white">
              {badgeLabel}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="right"
        sideOffset={12}
        className="w-[360px] overflow-hidden rounded-xl border-slate-200 p-0 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="font-heading text-sm font-bold text-arena-navy-800">Notificações</p>
            <p className="text-[11px] font-medium text-arena-navy-800/50">
              {unreadCount > 0 ? `${unreadCount} não lida(s)` : 'Tudo em dia'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllAsRead()}
              className="text-[11px] font-bold text-arena-button transition-colors hover:text-arena-button-hover"
            >
              Marcar todas como lidas
            </button>
          )}
        </div>

        <div className="max-h-[380px] overflow-y-auto">
          {isLoading && notifications.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10">
              <Loader2 className="size-4 animate-spin text-arena-navy-800/40" />
              <span className="text-xs font-medium text-arena-navy-800/60">Carregando...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell className="mx-auto mb-2 size-6 text-arena-navy-800/20" />
              <p className="text-xs font-semibold text-arena-navy-800/40">
                Nenhuma notificação por aqui.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.slice(0, 8).map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  compact
                  onClick={() => handleOpenNotification(notification)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 px-4 py-3">
          <Button
            asChild
            variant="ghost"
            className="h-9 w-full justify-center text-xs font-bold text-arena-navy-800 hover:bg-arena-navy-800/5"
            onClick={() => setOpen(false)}
          >
            <Link href={`/dashboard/notifications/${arenaId}`}>Ver todas</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
