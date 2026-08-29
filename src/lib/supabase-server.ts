import { createClient } from '@supabase/supabase-js'
import type { SupabaseAdminDatabase } from '@/types/supabase-admin.types'

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables'
    )
  }

  return createClient<SupabaseAdminDatabase>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}
