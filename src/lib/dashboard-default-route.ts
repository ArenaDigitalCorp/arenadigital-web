import { loadAccessibleArenas } from '@/lib/accessible-arenas'
import type { ArenaSummary } from '@/lib/dashboard-bootstrap.types'
import { requireAuthenticatedDbUser } from '@/lib/server-auth'

type DashboardSection =
  | 'arena'
  | 'stations'
  | 'finance'
  | 'products'
  | 'loyalty'
  | 'rotativo'
  | 'athletes'
  | 'turmas'
  | 'users'
  | 'subscription'
  | 'whatsapp'
  | 'templates-mensagens'
  | 'reports'
  | 'notifications'
  | 'publications'


function sectionPath(section: DashboardSection, arena: ArenaSummary): string | null {
  const id = arena.id
  const has = (key: string) => arena.resources.includes(key)
  switch (section) {
    case 'arena': return has('spaces') ? `/dashboard/arenas/${id}` : null
    case 'stations': return has('stations') ? `/dashboard/arenas/${id}/stations${arena.role === 'Caixa' && arena.assignedStationId ? '/' + arena.assignedStationId : ''}` : null
    case 'finance':
      if (has('finance.overview')) return `/dashboard/finance/${id}`
      if (has('finance.cash')) return `/dashboard/finance/${id}/caixa`
      return has('finance.settings') ? `/dashboard/finance/${id}/cadastros-auxiliares` : null
    case 'reports':
      if (has('reports.payments')) return `/dashboard/reports/${id}/status-pagamentos`
      if (has('reports.customers')) return `/dashboard/reports/${id}/clientes-overview`
      return has('reports.stations') ? `/dashboard/reports/${id}/movimentacao-estacoes` : null
    case 'products': return has('catalog') ? `/dashboard/settings/products/${id}` : null
    case 'users': return has('settings.users') && (arena.isOwner || arena.role === 'Gestor') ? `/dashboard/settings/users/${id}` : null
    case 'subscription': return has('settings.subscription') && (arena.isOwner || arena.role === 'Gestor') ? `/dashboard/settings/subscription/${id}` : null
    case 'whatsapp': return has('settings.whatsapp') ? `/dashboard/settings/whatsapp/${id}` : null
    case 'templates-mensagens': return has('settings.templates') ? `/dashboard/settings/templates-mensagens/${id}` : null
    case 'turmas': return has('classes') ? `/dashboard/turmas/${id}` : null
    case 'notifications': return ['dashboard','rotativo','bookings.single'].some(has) ? `/dashboard/notifications/${id}` : null
    default: return has(section) ? `/dashboard/${section}/${id}` : null
  }
}

export async function resolveDashboardDefaultRoute(section: DashboardSection): Promise<string> {
  const { dbUserId } = await requireAuthenticatedDbUser()
  const arenas = await loadAccessibleArenas(dbUserId)
  const sorted = [...arenas].sort((a, b) => Number(b.isOwner) - Number(a.isOwner))
  for (const arena of sorted) {
    const target = sectionPath(section, arena)
    if (target) return target
  }
  return '/dashboard'
}
