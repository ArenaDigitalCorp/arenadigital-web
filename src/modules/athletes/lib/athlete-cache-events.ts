export const ATHLETES_CHANGED_EVENT = 'arena-athletes-changed'
export const ATHLETES_CACHE_CHANNEL = 'arena-athletes-cache'
// Ephemeral sender id prevents a local event plus its cross-tab message from
// invalidating/refetching twice in the sender tab. This contains no user data.
export const ATHLETES_CACHE_SOURCE = Math.random().toString(36).slice(2)

export function openAthletesCacheChannel(): BroadcastChannel | null {
  try { return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(ATHLETES_CACHE_CHANNEL) }
  catch { return null } // Some browser privacy modes deny the optional channel.
}

// Shared forms also run outside the list. They need no QueryClient dependency.
export function notifyAthletesChanged(arenaId: string) {
  if (typeof window === 'undefined') return
  // Cache notifications must never turn a successful server write into an error.
  try { window.dispatchEvent(new CustomEvent(ATHLETES_CHANGED_EVENT, { detail: arenaId })) } catch {}
  const channel = openAthletesCacheChannel()
  try { channel?.postMessage({ arenaId, source: ATHLETES_CACHE_SOURCE }) } catch {}
  finally { channel?.close() }
}
