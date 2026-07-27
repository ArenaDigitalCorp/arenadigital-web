import { redirect } from 'next/navigation'
import { assertArenaBackofficeAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { SupabaseArenaRepository } from '@/modules/arenas/repositories/SupabaseArenaRepository'
import { getArenaNotificationsAction } from '@/modules/notifications/actions/notificationActions'
import { NotificationsPageClient } from '@/modules/notifications/components/NotificationsPageClient'

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ arenaId: string }>
}) {
  const { arenaId } = await params

  try {
    await assertArenaBackofficeAccess(arenaId)
  } catch {
    redirect('/dashboard/settings/arenas')
  }

  const arena = await new SupabaseArenaRepository(getSupabaseAdmin()).findById(arenaId)
  if (!arena) redirect('/dashboard/settings/arenas')

  const notifications = await getArenaNotificationsAction(arenaId, { limit: 100 })

  return (
    <NotificationsPageClient
      arenaId={arenaId}
      arenaName={arena.name}
      initialNotifications={notifications.data ?? []}
    />
  )
}
