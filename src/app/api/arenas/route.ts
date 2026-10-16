import { NextResponse } from 'next/server'
import { AuthorizationError, requireAuthenticatedDbUser } from '@/lib/server-auth'
import { loadAccessibleArenas } from '@/lib/accessible-arenas'

export async function GET() {
  try {
    const { dbUserId } = await requireAuthenticatedDbUser()
    return NextResponse.json(await loadAccessibleArenas(dbUserId))
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('[api/arenas] Failed to load arenas', error)
    return NextResponse.json({ error: 'Failed to load arenas' }, { status: 500 })
  }
}
