import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData.user

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getSupabaseAdmin()
  const { data: existingUser, error } = await admin
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[api/user/me] Failed to load user', error)
    return NextResponse.json({ error: 'Failed to load user' }, { status: 500 })
  }

  if (!existingUser) {
    return NextResponse.json({ error: 'User not provisioned' }, { status: 404 })
  }

  return NextResponse.json(existingUser)
}
