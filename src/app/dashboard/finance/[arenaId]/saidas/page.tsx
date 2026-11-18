import { assertArenaResourceAccess } from '@/lib/server-auth'
import { TransactionsPageClient } from '@/modules/finance/components/TransactionsPageClient'

export default async function SaidasPage({ params }: { params: Promise<{ arenaId: string }> }) {
    const { arenaId } = await params
    await assertArenaResourceAccess(arenaId, 'finance.overview')
    return <TransactionsPageClient arenaId={arenaId} type="saída" />
}
