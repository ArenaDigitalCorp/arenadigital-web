import type {
  PlatformArenaKind,
  PlatformCommercialStatus,
} from '../types/platform-admin.types'

export function getArenaCommercialStatus(input: {
  platformKind: PlatformArenaKind
  arenaStatus: string | null
  subscriptionStatus: string | null
  currentPeriodEnd: string | null
  isInternalPlan: boolean
  now?: number
}): PlatformCommercialStatus {
  if (input.platformKind === 'public_listing') return 'catalogo_publico'
  if (input.platformKind === 'demo') return 'demonstracao'
  if (['inativo', 'inactive'].includes(input.arenaStatus ?? '')) return 'desativada'
  if (input.isInternalPlan) return 'cliente_ativo'
  if (['past_due', 'unpaid', 'incomplete_expired'].includes(input.subscriptionStatus ?? '')) {
    return 'inadimplente'
  }
  if (input.subscriptionStatus === 'active' || input.subscriptionStatus === 'trialing') {
    if (input.currentPeriodEnd && new Date(input.currentPeriodEnd).getTime() <= (input.now ?? Date.now())) {
      return 'inadimplente'
    }
    return 'cliente_ativo'
  }
  if (['canceled', 'paused'].includes(input.subscriptionStatus ?? '')) return 'desativada'
  return 'prospect'
}
