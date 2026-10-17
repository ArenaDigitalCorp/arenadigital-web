'use client'

import { useEffect, useRef, useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'
import { useDbUser } from '@/contexts/UserContext'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { ATHLETE_QUERY_ROOT, createAthleteQueryClient, invalidateArenaAthletes } from '@/modules/athletes/lib/athlete-query-cache'
import { openAthletesCacheChannel, ATHLETES_CHANGED_EVENT, ATHLETES_CACHE_SOURCE } from '@/modules/athletes/lib/athlete-cache-events'

export function DashboardQueryProvider({ children }: { children: React.ReactNode }) {
  const { dbUser } = useDbUser()
  const scope = JSON.stringify([dbUser?.id ?? null, dbUser?.role ?? null, dbUser?.platform_access_level ?? null])
  return <QueryScope key={scope}>{children}</QueryScope>
}

function QueryScope({ children }: { children: React.ReactNode }) {
  const [accessInvalid, setAccessInvalid] = useState(false)
  const [client] = useState(() => createAthleteQueryClient(() => setAccessInvalid(true)))
  const authUserId = useRef<string | null | undefined>(undefined)
  const pathname = usePathname()
  const previousPath = useRef(pathname)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const id = session?.user.id ?? null
      if (!id || (authUserId.current !== undefined && authUserId.current !== id)) {
        client.clear()
        setAccessInvalid(true)
      } else if (event === 'USER_UPDATED') {
        void client.invalidateQueries({ queryKey: [ATHLETE_QUERY_ROOT] })
      }
      authUserId.current = id
    })
    return () => { data.subscription.unsubscribe(); client.clear() }
  }, [client])

  useEffect(() => {
    // Other modules can change inferred athlete profiles. Revalidate on return
    // without changing their business actions or caching their financial data.
    if (previousPath.current !== pathname && /^\/dashboard\/athletes\/[^/]+$/.test(previousPath.current)) {
      void client.invalidateQueries({ queryKey: [ATHLETE_QUERY_ROOT], refetchType: 'none' })
    }
    previousPath.current = pathname
  }, [client, pathname])

  useEffect(() => {
    const invalidate = (arenaId: unknown) => {
      if (typeof arenaId === 'string' && /^[0-9a-f-]{36}$/i.test(arenaId)) {
        void invalidateArenaAthletes(client, arenaId)
      }
    }
    const listener = (event: Event) => invalidate((event as CustomEvent<unknown>).detail)
    window.addEventListener(ATHLETES_CHANGED_EVENT, listener)
    const channel = openAthletesCacheChannel()
    if (channel) channel.onmessage = event => {
      if (event.data?.source !== ATHLETES_CACHE_SOURCE) invalidate(event.data?.arenaId)
    }
    return () => { window.removeEventListener(ATHLETES_CHANGED_EVENT, listener); channel?.close() }
  }, [client])

  if (accessInvalid) return (
    <p role="status" className="p-6">Seu acesso ao painel foi encerrado ou alterado. <button type="button" className="underline" onClick={() => window.location.assign('/dashboard')}>Atualizar painel</button></p>
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
