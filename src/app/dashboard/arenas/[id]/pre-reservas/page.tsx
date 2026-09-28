import { redirect } from 'next/navigation'
import { assertArenaBackofficeAccess } from '@/lib/server-auth'
import {
  getAppBookingRequestGroupsAction,
  getAppBookingRequestsAction,
} from '@/modules/bookings/actions/appBookingRequestActions'
import { AppBookingRequestsPageClient } from '@/modules/bookings/components/AppBookingRequestsPageClient'

export default async function AppBookingRequestsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: arenaId } = await params

  try {
    await assertArenaBackofficeAccess(arenaId)
  } catch {
    redirect('/dashboard')
  }

  const [result, groupsResult] = await Promise.all([
    getAppBookingRequestsAction(arenaId),
    getAppBookingRequestGroupsAction(arenaId),
  ])

  return (
    <AppBookingRequestsPageClient
      arenaId={arenaId}
      initialRequests={result.data}
      initialGroups={groupsResult.data}
      initialRequestNextOffset={result.nextOffset}
      initialGroupNextOffset={groupsResult.nextOffset}
      acceptsRequests={result.acceptsRequests}
      initialError={[result.error, groupsResult.error].filter(Boolean).join(' ') || undefined}
    />
  )
}
