import { redirect } from 'next/navigation'
import { assertPlatformAdminAccess } from '@/lib/server-auth'
import { getPlatformAdminOverview } from '@/modules/platform-admin/actions/platformAdminActions'
import { PlatformAdminConsole } from '@/modules/platform-admin/components/PlatformAdminConsole'

export default async function PlatformAdminPage() {
  let accessLevel: 'platform_admin' | 'super_admin'

  try {
    const profile = await assertPlatformAdminAccess()
    accessLevel = profile.accessLevel
  } catch {
    redirect('/dashboard')
  }

  if (accessLevel === 'super_admin') {
    redirect('/dashboard/admin/super-admin')
  }

  const overview = await getPlatformAdminOverview()
  return <PlatformAdminConsole overview={overview} />
}
