import { requireAuthenticatedDbUser, assertArenaBackofficeAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { SupabaseArenaRepository } from '@/modules/arenas/repositories/SupabaseArenaRepository'
import { ArenaForm } from '@/modules/arenas/components/ArenaForm'
import { redirect } from 'next/navigation'

export default async function EditArenaPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    try {
        await assertArenaBackofficeAccess(id)
    } catch {
        redirect('/dashboard/settings/arenas')
    }

    const { dbUserId } = await requireAuthenticatedDbUser()
    const arena = await new SupabaseArenaRepository(getSupabaseAdmin()).findById(id)

    if (!arena) redirect('/dashboard/settings/arenas')

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Editar Arena</h2>
                <p className="text-muted-foreground">Atualize as informações da sua arena.</p>
            </div>
            <ArenaForm ownerId={dbUserId} initialData={arena} />
        </div>
    )
}
