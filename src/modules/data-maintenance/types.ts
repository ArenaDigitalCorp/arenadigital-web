import type { CleanupModule } from './catalog'
export type { CleanupModule } from './catalog'
export type CleanupArena = { id: string; name: string; document: string | null; kind: string }
export type CleanupBlocker = { code: string; message: string; count: number; requiredModule?: CleanupModule | null }
export type CleanupDependency = {
  from: CleanupModule
  to: CleanupModule | null
  label: string
  kind: 'foreign_key' | 'financial_source' | 'stock_source' | 'closed_cash'
  count: number
  includedCount: number
  missingCount: number
  blockedCount: number
  canInclude: boolean
  reasons?: Array<'financial' | 'other_arena' | 'after_cutoff' | 'protected_reference'>
}
export type CleanupOperation = {
  id: string
  arenaId: string
  arenaName: string
  reason: string
  modules: CleanupModule[]
  cutoff: string
  status: 'preview' | 'completed' | 'restored'
  createdAt: string
  expiresAt: string
  completedAt: string | null
  restoredAt: string | null
  summary: {
    transactionCount: number
    sessionCount: number
    openSessionCount: number
    incomingTotal: string
    outgoingTotal: string
    preservedAutomaticCount: number
    preservedTransactionCount: number
    blockers: CleanupBlocker[]
    canExecute: boolean
    recordCount?: number
    effectCount?: number
    moduleCounts?: Array<{ module: CleanupModule; label: string; count: number }>
    bookingGroups?: { groups: number; items: number; policySnapshots: number }
    dependencies?: CleanupDependency[]
  }
}
export type CleanupResult<T> = { success: true; data: T } | { success: false; error: string; unavailable?: boolean }
export type CleanupSelection = {
  arenaId: string
  requestedModules: CleanupModule[]
  modules: CleanupModule[]
  cutoff: string
  dependencies: CleanupDependency[]
  resolved: true
}
