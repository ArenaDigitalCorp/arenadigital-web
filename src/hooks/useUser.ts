"use client"

import * as React from "react"
import type { User } from "@supabase/supabase-js"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

type UseUserResult = {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

export function useUser(): UseUserResult {
  const [user, setUser] = React.useState<User | null>(null)
  const [loading, setLoading] = React.useState(true)
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), [])

  React.useEffect(() => {
    let mounted = true

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return
      setUser(data.user)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [supabase])

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
  }, [supabase])

  return { user, loading, signOut }
}
