'use client'

import { useEffect, useRef, useState } from 'react'
import type { LoyaltyPageRead } from './page-read'
import type { PaginatedResult } from '../types/loyalty.types'

/** No shared financial cache. Each filter change creates a new, cancellable read. */
export function useLoyaltyPage<T>(initialQuery: LoyaltyPageRead, initialData: PaginatedResult<T>) {
  const [request, setRequest] = useState({ query: initialQuery, version: 0 })
  const [state, setState] = useState<{
    version: number; data?: PaginatedResult<T>; error?: string; blocked?: boolean
  }>({ version: 0, data: initialData })
  const previousSearch = useRef(initialQuery.search)
  const blocked = useRef(false)

  useEffect(() => {
    if (request.version === 0 || blocked.current) return
    let active = true
    const controller = new AbortController()
    const { query, version } = request
    const delay = previousSearch.current !== query.search ? 300 : 0
    previousSearch.current = query.search
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/loyalty/read', {
          method: 'POST', credentials: 'same-origin', cache: 'no-store',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query), signal: controller.signal,
        })
        const result = await response.json()
        if (!response.ok || !result.success) {
          if (active) {
            blocked.current = [401, 403, 409].includes(response.status)
            setState({ version, error: result.error || 'Não foi possível carregar os dados.', blocked: blocked.current })
          }
          return
        }
        if (active) setState({ version, data: result.data })
      } catch {
        if (active) setState({ version, error: 'Não foi possível carregar os dados. Tente novamente.' })
      }
    }, delay)
    return () => { active = false; clearTimeout(timer); controller.abort() }
  }, [request])

  const current = state.blocked || state.version === request.version ? state : null
  return {
    query: request.query,
    setQuery: (update: (query: LoyaltyPageRead) => LoyaltyPageRead) => {
      if (!blocked.current) setRequest(current => ({ query: update(current.query), version: current.version + 1 }))
    },
    data: current?.data,
    isLoading: !current,
    error: current?.error,
    blocked: current?.blocked,
    retry: () => {
      if (!blocked.current) setRequest(current => ({ ...current, version: current.version + 1 }))
    },
  }
}
