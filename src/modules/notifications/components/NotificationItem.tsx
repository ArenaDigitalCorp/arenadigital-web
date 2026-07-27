'use client'

import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { NotificationIcon } from '@/modules/notifications/components/NotificationIcon'
import {
  NOTIFICATION_TYPE_LABEL,
  type ArenaNotification,
} from '@/modules/notifications/types/notification.types'

interface Props {
  notification: ArenaNotification
  onClick?: () => void
  /** Variante compacta usada dentro do popover do sino. */
  compact?: boolean
}

export function NotificationItem({ notification, onClick, compact = false }: Props) {
  const isUnread = !notification.read_at
  const relative = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
    locale: ptBR,
  })

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 text-left transition-colors',
        compact ? 'px-4 py-3' : 'rounded-lg px-4 py-4',
        isUnread ? 'bg-arena-button/[0.04]' : 'bg-transparent',
        'hover:bg-arena-navy-800/[0.04]'
      )}
    >
      <NotificationIcon type={notification.type} />

      <span className="min-w-0 flex-1 space-y-1">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              'truncate text-sm text-arena-navy-800',
              isUnread ? 'font-bold' : 'font-semibold'
            )}
          >
            {notification.title}
          </span>
          {isUnread && (
            <span className="size-2 shrink-0 rounded-full bg-arena-button" aria-label="Não lida" />
          )}
        </span>

        {notification.body && (
          <span
            className={cn(
              'block text-xs font-medium leading-snug text-arena-navy-800/60',
              compact && 'line-clamp-2'
            )}
          >
            {notification.body}
          </span>
        )}

        <span className="flex items-center gap-2 pt-0.5">
          <Badge
            variant="outline"
            className="h-5 rounded-full border-arena-navy-800/15 px-2 text-[10px] font-bold uppercase tracking-wide text-arena-navy-800/60"
          >
            {NOTIFICATION_TYPE_LABEL[notification.type]}
          </Badge>
          <span className="text-[11px] font-medium text-arena-navy-800/40">{relative}</span>
        </span>
      </span>
    </button>
  )
}
