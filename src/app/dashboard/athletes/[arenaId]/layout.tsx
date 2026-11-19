import type { ReactNode } from 'react'
import { assertArenaResourceAccess } from '@/lib/server-auth'
import { redirect } from 'next/navigation'

export default async function AthleteLayout({ params, children }: { params: Promise<{ arenaId: string }>; children: ReactNode }) {
    const { arenaId } = await params
    try {
        await assertArenaResourceAccess(arenaId, 'athletes')
    } catch {
        redirect('/dashboard')
    }
    return children
}
