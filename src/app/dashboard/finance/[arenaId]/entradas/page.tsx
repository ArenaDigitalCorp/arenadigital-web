import { TransactionsPageClient } from '@/modules/finance/components/TransactionsPageClient'

export default async function EntradasPage({ params }: { params: Promise<{ arenaId: string }> }) {
    const { arenaId } = await params
    return <TransactionsPageClient arenaId={arenaId} type="entrada" />
}
