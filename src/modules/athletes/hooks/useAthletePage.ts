'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDbUser } from '@/contexts/UserContext'
import { athletePageOptions } from '../lib/athlete-query-cache'
import type { AthletePageQuery } from '../types/list-page.types'

export function useAthletePage(arenaId: string | null, tutorial: boolean, query: AthletePageQuery) {
  const { dbUser, error: userError, retry: retryUser } = useDbUser()
  const client = useQueryClient()
  const [debouncedSearch, setDebouncedSearch] = useState(query.search)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(query.search), query.search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [query.search])
  const settled = query.search === debouncedSearch
  const scope = useMemo(() => ({ userId: dbUser?.id ?? 'pending', arenaId: arenaId ?? 'pending', tutorial }), [dbUser?.id, arenaId, tutorial])
  const enabled = !!arenaId && (tutorial || !!dbUser) && settled
  const result = useQuery({ ...athletePageOptions(scope, query), enabled })
  // A failed bootstrap/fallback must not leave an identity-dependent read in
  // an endless loading state. Keep it disabled until the user context recovers.
  const waitingForUserRecovery = !tutorial && !dbUser && !!userError
  const waitingForConnection = enabled && result.isPaused
  const data = enabled && !result.isError && !waitingForConnection ? result.data : undefined
  const pendingPrefetch = useRef<readonly unknown[] | null>(null)

  useEffect(() => () => {
    const queryKey = pendingPrefetch.current
    if (queryKey) void client.cancelQueries({ queryKey, exact: true, type: 'inactive' })
    pendingPrefetch.current = null
  }, [client])

  useEffect(() => {
    // Cancel obsolete prefetches during setup, after useQuery applies its new
    // observer key. Passive cleanup runs earlier, while a page just selected
    // by the user may still look inactive, and would abort its reusable read.
    const previous = pendingPrefetch.current
    pendingPrefetch.current = null
    if (previous) void client.cancelQueries({ queryKey: previous, exact: true, type: 'inactive' })
    if (!enabled || tutorial || result.isFetching || !data || data.profilesAvailable === false
        || data.page !== query.page || data.page * query.pageSize >= data.total) return
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
    if (connection?.saveData || connection?.effectiveType?.endsWith('2g')) return
    const next = athletePageOptions(scope, { ...query, page: query.page + 1 })
    pendingPrefetch.current = next.queryKey
    void client.prefetchQuery(next)
  }, [client, enabled, tutorial, result.isFetching, data, query, scope])

  return {
    data,
    isLoading: !waitingForUserRecovery && (!enabled || (result.isPending && !waitingForConnection)),
    isRefreshing: result.isFetching && !!data,
    error: waitingForUserRecovery ? 'Não foi possível carregar seu usuário. Tente novamente.'
      : waitingForConnection ? 'Sem conexão no momento. Reconecte para atualizar os atletas.'
      : enabled && result.isError ? result.error.message : undefined,
    retry: () => {
      if (waitingForUserRecovery) retryUser()
      else void result.refetch()
    },
  }
}
