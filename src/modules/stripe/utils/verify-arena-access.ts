import { getSupabaseAdmin } from '@/lib/supabase-server'

export async function verifyArenaAccess(clerkUserId: string, arenaId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin()

  const { data } = await supabase
    .from('arenas')
    .select('id, users!inner(id)')
    .eq('id', arenaId)
    .eq('users.clerk_user_id', clerkUserId)
    .maybeSingle()

  return !!data
}
