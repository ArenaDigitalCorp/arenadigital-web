import { CalendarCheck, RefreshCw, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ArenaNotificationType } from '@/modules/notifications/types/notification.types'

const ICON_BY_TYPE = {
  booking_created: CalendarCheck,
  rotativo_inscricao: RefreshCw,
  open_game_created: Users,
} as const satisfies Record<ArenaNotificationType, typeof CalendarCheck>

const TONE_BY_TYPE: Record<ArenaNotificationType, string> = {
  booking_created: 'bg-arena-button/10 text-arena-button',
  rotativo_inscricao: 'bg-[#20B2AA]/10 text-[#0D9488]',
  open_game_created: 'bg-arena-navy-800/10 text-arena-navy-800',
}

export function NotificationIcon({
  type,
  className,
}: {
  type: ArenaNotificationType
  className?: string
}) {
  const Icon = ICON_BY_TYPE[type]

  return (
    <span
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full',
        TONE_BY_TYPE[type],
        className
      )}
      aria-hidden
    >
      <Icon className="size-4" />
    </span>
  )
}
