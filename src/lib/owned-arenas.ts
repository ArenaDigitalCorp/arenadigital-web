import { cache } from 'react'
import { getSupabaseAdmin } from '@/lib/supabase-server'

// Share the ownership read between the render's access check and its selector.
// React cache does not retain results across requests.
export const loadOwnedArenas = cache(async (dbUserId: string) => {
  return getSupabaseAdmin()
    .from('arenas')
    .select('id, name')
    .eq('owner_id', dbUserId)
    .order('name')
})
