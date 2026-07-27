/** Eventos do app do atleta que geram aviso para o backoffice da arena. */
export const ARENA_NOTIFICATION_TYPES = [
  'booking_created',
  'rotativo_inscricao',
  'open_game_created',
] as const

export type ArenaNotificationType = (typeof ARENA_NOTIFICATION_TYPES)[number]

export interface ArenaNotification {
  id: string
  arena_id: string
  type: ArenaNotificationType
  title: string
  body: string | null
  payload: Record<string, unknown>
  entity_type: string | null
  entity_id: string | null
  atleta_id: string | null
  read_at: string | null
  created_at: string
}

export function isArenaNotificationType(value: string): value is ArenaNotificationType {
  return (ARENA_NOTIFICATION_TYPES as readonly string[]).includes(value)
}

export const NOTIFICATION_TYPE_LABEL: Record<ArenaNotificationType, string> = {
  booking_created: 'Reserva',
  rotativo_inscricao: 'Rotativo',
  open_game_created: 'Game Match',
}

/** Para onde o gestor é levado ao clicar no aviso. */
export function notificationTargetPath(
  notification: Pick<ArenaNotification, 'arena_id' | 'type' | 'payload'>
): string {
  const { arena_id: arenaId, type, payload } = notification

  if (type === 'booking_created') {
    const courtId = typeof payload?.court_id === 'string' ? payload.court_id : null
    return courtId
      ? `/dashboard/arenas/${arenaId}/courts/${courtId}/calendar`
      : `/dashboard/arenas/${arenaId}?tab=operacao`
  }

  if (type === 'rotativo_inscricao') {
    return `/dashboard/rotativo/${arenaId}`
  }

  return `/dashboard/arenas/${arenaId}?tab=operacao`
}
