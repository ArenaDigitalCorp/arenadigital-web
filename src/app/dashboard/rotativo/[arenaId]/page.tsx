import { assertArenaAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { SupabaseArenaRepository } from '@/modules/arenas/repositories/SupabaseArenaRepository'
import { getRotativosAction } from '@/modules/rotativos/actions/rotativoActions'
import { RotativoPageClient } from './RotativoPageClient'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'

export default async function RotativoPage({ params }: { params: Promise<{ arenaId: string }> }) {
    const { arenaId } = await params

    try {
        await assertArenaAccess(arenaId)
    } catch {
        redirect('/dashboard/settings/arenas')
    }

    const today = format(new Date(), 'yyyy-MM-dd')
    const repo = new SupabaseArenaRepository(getSupabaseAdmin())

    const [arena, rotativosResult] = await Promise.all([
        repo.findById(arenaId),
        getRotativosAction(arenaId, today),
    ])

    return (
        <RotativoPageClient
            arenaId={arenaId}
            initialSports={arena?.sports ?? []}
            initialRotativos={rotativosResult.success ? (rotativosResult.data ?? []) : []}
            initialDate={today}
        />
    )
}
