import { assertPlatformSuperAdminAccess } from '@/lib/server-auth'
import { MaintenanceSection } from '@/modules/data-maintenance/components/MaintenanceSection'
import { getCleanupArenas } from '@/modules/data-maintenance/actions'

export default async function MaintenancePage({ searchParams }: {searchParams:Promise<{arena?:string}>}) {
  await assertPlatformSuperAdminAccess()
  const [{arena},result] = await Promise.all([searchParams,getCleanupArenas()])
  const connection = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const environment = connection.includes('vsehlxyowqqhakbjiznv.') ? 'Produção'
    : connection.includes('zojnnynuxlmcdsfzdnie.') ? 'Homologação'
    : /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(connection) ? 'Local' : 'Conexão personalizada'
  return <MaintenanceSection arenas={result.success?result.data:[]} initialArenaId={arena}
    environment={environment} loadError={result.success?undefined:result.error}/>
}
