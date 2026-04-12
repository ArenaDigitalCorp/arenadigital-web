import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { UserService } from '@/modules/users/services/userService'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseAdmin()

  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('clerk_user_id', userId)
    .maybeSingle()

  if (existingUser) {
    return NextResponse.json(existingUser)
  }

  const clerkUser = await currentUser()
  if (!clerkUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const email = clerkUser.emailAddresses?.[0]?.emailAddress ?? ''
  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ')
  const metadata = clerkUser.unsafeMetadata as Record<string, unknown>

  try {
    const user = await UserService.syncUser(
      userId,
      email,
      name,
      metadata?.arenaName as string | undefined,
      metadata?.cpf as string | undefined,
      metadata?.phone as string | undefined,
      metadata?.addressData,
    )
    return NextResponse.json(user)
  } catch (error) {
    console.error('[api/user/me] Failed to sync user', error)
    return NextResponse.json({ error: 'Failed to sync user' }, { status: 500 })
  }
}
