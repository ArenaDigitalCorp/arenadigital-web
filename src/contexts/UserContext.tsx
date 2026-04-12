'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

type DbUser = {
  id: string
  clerk_user_id: string
  email: string
  name: string
  role: string
  created_at: string
}

type UserContextType = {
  dbUser: DbUser | null
  isLoading: boolean
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [dbUser, setDbUser] = useState<DbUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/user/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setDbUser(data))
      .catch(() => setDbUser(null))
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <UserContext.Provider value={{ dbUser, isLoading }}>
      {children}
    </UserContext.Provider>
  )
}

export function useDbUser() {
  const context = useContext(UserContext)
  if (!context) throw new Error('useDbUser must be used within a UserProvider')
  return context
}
