import { onlyDigits } from '@/lib/brasil-document'

export const ARENA_LEGAL_NAME_MAX_LENGTH = 120

export function getArenaLegalNameError(document: string | null | undefined, legalName: unknown): string | null {
  if (legalName != null && typeof legalName !== 'string') return 'Informe uma razão social válida.'
  const name = typeof legalName === 'string' ? legalName.trim() : ''
  if (!name) return onlyDigits(document).length === 14 ? 'Informe a razão social da empresa.' : null
  if (name.length < 2) return 'A razão social deve ter pelo menos 2 caracteres.'
  if (name.length > ARENA_LEGAL_NAME_MAX_LENGTH) return 'A razão social deve ter no máximo 120 caracteres.'
  return null
}
