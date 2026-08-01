export const ARENA_SIGNUP_INTENT_KEY = 'arena_signup_intent'

export type ArenaSignupAddress = {
  cep?: string
  state?: string
  city?: string
  id_municipio?: number
  neighborhood?: string
  street?: string
  number?: string
  complement?: string
}

export type ArenaSignupIntent = {
  version: 1
  arenaName: string
  arenaDocument: string
  phone: string
  cpf: string
  addressData: ArenaSignupAddress
}

type ArenaSignupIntentInput = Omit<ArenaSignupIntent, 'version'>

export function createArenaSignupIntent(input: ArenaSignupIntentInput): ArenaSignupIntent {
  return {
    version: 1,
    arenaName: input.arenaName.trim(),
    arenaDocument: input.arenaDocument.trim(),
    phone: input.phone.trim(),
    cpf: input.cpf.trim(),
    addressData: { ...input.addressData },
  }
}

export function readArenaSignupIntent(appMetadata: unknown): ArenaSignupIntent | null {
  if (!appMetadata || typeof appMetadata !== 'object') return null

  const rawIntent = (appMetadata as Record<string, unknown>)[ARENA_SIGNUP_INTENT_KEY]
  if (!rawIntent || typeof rawIntent !== 'object') return null

  const intent = rawIntent as Record<string, unknown>
  if (intent.version !== 1) return null
  if (typeof intent.arenaName !== 'string' || !intent.arenaName.trim()) return null
  if (typeof intent.arenaDocument !== 'string' || !intent.arenaDocument.trim()) return null
  if (typeof intent.phone !== 'string' || !intent.phone.trim()) return null
  if (typeof intent.cpf !== 'string') return null
  if (!intent.addressData || typeof intent.addressData !== 'object') return null

  const addressData = intent.addressData as Record<string, unknown>
  if (typeof addressData.id_municipio !== 'number') return null

  return createArenaSignupIntent({
    arenaName: intent.arenaName,
    arenaDocument: intent.arenaDocument,
    phone: intent.phone,
    cpf: intent.cpf,
    addressData: addressData as ArenaSignupAddress,
  })
}

export function consumeArenaSignupIntentMetadata(appMetadata: unknown): Record<string, unknown> {
  if (!appMetadata || typeof appMetadata !== 'object') return {}

  const metadata = { ...(appMetadata as Record<string, unknown>) }
  delete metadata[ARENA_SIGNUP_INTENT_KEY]
  return metadata
}
