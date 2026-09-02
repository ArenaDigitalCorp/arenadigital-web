import { redirect } from 'next/navigation'
import { assertArenaBackofficeAccess } from '@/lib/server-auth'
import { getAppBookingRequestsAction } from '@/modules/bookings/actions/appBookingRequestActions'
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

  const result = await getAppBookingRequestsAction(arenaId)

  return (
    <AppBookingRequestsPageClient
      arenaId={arenaId}
      initialRequests={result.data}
      acceptsRequests={result.acceptsRequests}
      initialError={result.error}
    />
  )
}
