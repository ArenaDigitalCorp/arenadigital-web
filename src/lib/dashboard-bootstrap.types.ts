import type { ArenaAccessRole } from '@/lib/arena-permissions'
import type { PlatformAccessLevel } from '@/lib/server-auth'
import type { Database } from '@/types/supabase.types'

export type DashboardUser = Pick<Database['public']['Tables']['users']['Row'],
  'id' | 'email' | 'name' | 'role' | 'created_at' | 'onboarding_completed_at' | 'onboarding_version'
> & { platform_access_level: PlatformAccessLevel | null }

export type ArenaSummary = {
  id: string
  name: string
  isOwner: boolean
  role: ArenaAccessRole
  assignedStationId: string | null
}

export type DashboardBootstrap = {
  user: DashboardUser | null
  arenas: ArenaSummary[] | null
}
