import { QueryCache, QueryClient, queryOptions } from '@tanstack/react-query'
import type { AthletePage, AthletePageQuery } from '../types/list-page.types'

export const ATHLETE_QUERY_ROOT = 'arena-athletes'
export const ATHLETE_STALE_MS = 30_000
export const ATHLETE_GC_MS = 60_000
export type AthleteQueryScope = { userId: string; arenaId: string; tutorial: boolean }

export class AthletePageRequestError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

export function athletePageKey(scope: AthleteQueryScope, query: AthletePageQuery) {
  return [ATHLETE_QUERY_ROOT, scope.userId, scope.arenaId, scope.tutorial ? 'tutorial' : 'live',
    { ...query, search: query.search.trim(), sort: { ...query.sort } }] as const
}

export function athletePageOptions(scope: AthleteQueryScope, query: AthletePageQuery) {
  return queryOptions({
    queryKey: athletePageKey(scope, query),
    queryFn: async ({ signal }): Promise<AthletePage> => {
      if (scope.tutorial) {
        const [{ tutorialAthletePage }, { tutorialAthletes }] = await Promise.all([
          import('./tutorial-athlete-page'), import('@/lib/tutorial-mock-data'),
        ])
        return tutorialAthletePage(tutorialAthletes, query)
      }
      // Keep search text and identity out of URLs/access logs. This read-only
      // route supports cancellation and parallel requests, unlike action dispatch.
      let response: Response
      try {
        response = await fetch('/api/athletes/page', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...query, search: query.search.trim(), userId: scope.userId, arenaId: scope.arenaId }),
          credentials: 'same-origin', cache: 'no-store', signal,
        })
      } catch (error) {
        if (signal.aborted) throw error
        throw new AthletePageRequestError('Não foi possível carregar os atletas. Tente novamente.', 0)
      }
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.success) {
        throw new AthletePageRequestError(body?.error ?? 'Não foi possível carregar os atletas. Tente novamente.', response.status)
      }
      return body.data
    },
    staleTime: cached => cached.state.data?.profilesAvailable === false ? 0 : ATHLETE_STALE_MS,
    // SSR instances die with their render; do not retain them with GC timers.
    gcTime: typeof window === 'undefined' ? Infinity : ATHLETE_GC_MS,
    retry: false,
    networkMode: scope.tutorial ? 'always' : 'online',
    refetchInterval: scope.tutorial ? false : ATHLETE_STALE_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  })
}

// One instance per mounted user scope. Never a module-level singleton or persisted cache.
export function createAthleteQueryClient(onAccessInvalid: () => void = () => {}) {
  const queryCache = new QueryCache({ onError(error) {
    if (!(error instanceof AthletePageRequestError)) return
    if (error.status === 401 || error.status === 403 || error.status === 409) {
      // A denied prefetch must also hide the currently displayed cached page.
      // The provider blocks private content until a full server access refresh.
      onAccessInvalid()
      queryCache.clear()
    }
  } })
  return new QueryClient({ queryCache, defaultOptions: { mutations: { retry: false } } })
}

export async function invalidateArenaAthletes(client: QueryClient, arenaId: string) {
  const filter = { predicate: (query: { queryKey: readonly unknown[] }) =>
    query.queryKey[0] === ATHLETE_QUERY_ROOT && query.queryKey[2] === arenaId }
  const cancelled = client.cancelQueries(filter)
  // Mark stale synchronously, before a success callback remounts the list.
  await client.invalidateQueries({ ...filter, refetchType: 'none' })
  await cancelled
  await client.refetchQueries({ ...filter, type: 'active' }, { cancelRefetch: false })
}
