import { redirect } from 'next/navigation'
import { assertPlatformAdminAccess } from '@/lib/server-auth'
import { getPlatformAdminOverview } from '@/modules/platform-admin/actions/platformAdminActions'
import { PlatformAdminConsole } from '@/modules/platform-admin/components/PlatformAdminConsole'

export default async function PlatformAdminPage() {
  try {
    await assertPlatformAdminAccess()
  } catch {
    redirect('/dashboard')
  }

  const overview = await getPlatformAdminOverview()
  return <PlatformAdminConsole overview={overview} />
}
