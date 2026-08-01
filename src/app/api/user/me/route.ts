import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { resolveAuthenticatedDbUser } from '@/lib/account-identity'

type PlatformAccessRpcClient = {
  rpc: (
    name: 'get_platform_access_level',
    args: { p_user_id: string },
  ) => Promise<{ data: string | null; error: { message: string } | null }>
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData.user

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getSupabaseAdmin()
  const resolvedUser = await resolveAuthenticatedDbUser(admin, user.id)

  if (!resolvedUser) {
    return NextResponse.json({ error: 'User not provisioned' }, { status: 404 })
  }

  const [{ data: existingUser, error }, { data: platformAccessLevel, error: platformError }] = await Promise.all([
    admin
      .from('users')
      .select('id, email, name, cpf, role, created_at, onboarding_completed_at, onboarding_version')
      .eq('id', resolvedUser.id)
      .maybeSingle(),
    (admin as unknown as PlatformAccessRpcClient).rpc('get_platform_access_level', {
      p_user_id: resolvedUser.id,
    }),
  ])

  if (error) {
    console.error('[api/user/me] Failed to load user', error)
    return NextResponse.json({ error: 'Failed to load user' }, { status: 500 })
  }

  if (platformError) {
    console.error('[api/user/me] Failed to load platform access', platformError)
    return NextResponse.json({ error: 'Failed to load user access' }, { status: 500 })
  }

  return NextResponse.json({
    ...existingUser,
    platform_access_level:
      platformAccessLevel === 'employee' ||
      platformAccessLevel === 'platform_admin' ||
      platformAccessLevel === 'super_admin'
        ? platformAccessLevel
        : null,
  })
}
