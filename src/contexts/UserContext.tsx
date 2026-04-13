'use client'

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react'

type DbUser = {
  id: string
  clerk_user_id: string
  email: string
  name: string
  role: string | null
  created_at: string
}

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: DbUser }
  | { status: 'error'; message: string }

type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: DbUser }
  | { type: 'FETCH_ERROR'; message: string }
  | { type: 'RESET' }

function reducer(_: State, action: Action): State {
  switch (action.type) {
    case 'FETCH_START':  return { status: 'loading' }
    case 'FETCH_SUCCESS': return { status: 'success', data: action.payload }
    case 'FETCH_ERROR':  return { status: 'error', message: action.message }
    case 'RESET':        return { status: 'idle' }
  }
}

type UserContextType = {
  dbUser: DbUser | null
  isLoading: boolean
  error: string | null
  retry: () => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { status: 'idle' })

  const fetchUser = useCallback(async () => {
    dispatch({ type: 'FETCH_START' })
    try {
      const res = await fetch('/api/user/me')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: DbUser = await res.json()
      dispatch({ type: 'FETCH_SUCCESS', payload: data })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar usuário'
      dispatch({ type: 'FETCH_ERROR', message })
    }
  }, [])

  useEffect(() => { fetchUser() }, [fetchUser])

  const dbUser = state.status === 'success' ? state.data : null
  const isLoading = state.status === 'idle' || state.status === 'loading'
  const error = state.status === 'error' ? state.message : null

  return (
    <UserContext.Provider value={{ dbUser, isLoading, error, retry: fetchUser }}>
      {children}
    </UserContext.Provider>
  )
}

export function useDbUser() {
  const context = useContext(UserContext)
  if (!context) throw new Error('useDbUser must be used within a UserProvider')
  return context
}
