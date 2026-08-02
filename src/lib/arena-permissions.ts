export const ARENA_MEMBERSHIP_ROLES = ['Gestor', 'Atendente', 'Caixa'] as const

export type ArenaMembershipRole = (typeof ARENA_MEMBERSHIP_ROLES)[number]
export type ArenaAccessRole = 'Owner' | 'PlatformAdmin' | ArenaMembershipRole

export type ArenaPermissionSubject = {
  isOwner: boolean
  role: ArenaAccessRole
}

export function normalizeArenaMembershipRole(
  role: string | null | undefined,
): ArenaMembershipRole | null {
  return ARENA_MEMBERSHIP_ROLES.find((candidate) => candidate === role) ?? null
}

export function canAccessArenaBackoffice(subject: ArenaPermissionSubject) {
  return subject.isOwner || subject.role !== 'Caixa'
}

export function canManageArena(subject: ArenaPermissionSubject) {
  return subject.isOwner || subject.role === 'Gestor' || subject.role === 'PlatformAdmin'
}

export function canManageArenaSubscription(subject: ArenaPermissionSubject) {
  return subject.isOwner || subject.role === 'Gestor'
}
