'use client'

import { useSyncExternalStore } from 'react'
import { skipToken, useQuery } from '@tanstack/react-query'
import { getArenaTermsStatus } from './arena-terms-actions'

const subscribeToMount = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false

export function arenaTermsQueryKey(arenaId: string | undefined) {
    return ['arena-terms', arenaId] as const
}

export function useArenaTerms(arenaId: string | undefined) {
    // Nested dashboard sections can hydrate after the surrounding notice has
    // filled the in-memory query cache. Keep their first render equal to SSR.
    const hydrated = useSyncExternalStore(subscribeToMount, clientSnapshot, serverSnapshot)
    const query = useQuery({
        queryKey: arenaTermsQueryKey(arenaId),
        queryFn: arenaId ? () => getArenaTermsStatus(arenaId) : skipToken,
        enabled: hydrated && Boolean(arenaId),
        staleTime: 30_000,
        retry: false,
    })
    return {
        data: hydrated ? query.data : undefined,
        isPending: !hydrated || query.isPending,
        isError: hydrated && query.isError,
        refetch: query.refetch,
    }
}
