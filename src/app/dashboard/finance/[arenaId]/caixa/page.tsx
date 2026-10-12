import { redirect } from 'next/navigation'
import { assertArenaCaixaAccess } from '@/lib/server-auth'
import { CaixaPageClient } from '@/modules/finance/components/CaixaPageClient'

export default async function CaixaPage({ params }: { params: Promise<{ arenaId: string }> }) {
    const { arenaId } = await params

    try {
        await assertArenaCaixaAccess(arenaId)
    } catch {
        redirect('/dashboard/settings/arenas')
    }

    return <CaixaPageClient arenaId={arenaId} />
}
