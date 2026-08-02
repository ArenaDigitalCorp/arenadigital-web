import { redirect } from 'next/navigation'
import { assertPlatformSuperAdminAccess } from '@/lib/server-auth'
import { getPlatformAdminOverview } from '@/modules/platform-admin/actions/platformAdminActions'
import { PlatformAdminConsole } from '@/modules/platform-admin/components/PlatformAdminConsole'

export default async function SuperAdminPage() {
  try {
    await assertPlatformSuperAdminAccess()
  } catch {
    redirect('/dashboard')
  }

  const overview = await getPlatformAdminOverview()
  return <PlatformAdminConsole overview={overview} surface="super-admin" />
}
