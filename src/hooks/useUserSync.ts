'use client'

import { useDbUser } from '@/contexts/UserContext'

export function useUserSync() {
  return useDbUser()
}
