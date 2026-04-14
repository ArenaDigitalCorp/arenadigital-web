import { assertArenaAccess } from '@/lib/server-auth'
import { getSubscription } from '@/modules/stripe/usecases/get-subscription.usecase'
import { getPaymentHistory } from '@/modules/stripe/usecases/get-payment-history.usecase'
import { SubscriptionPageClient } from './SubscriptionPageClient'
import { redirect } from 'next/navigation'

export default async function SubscriptionArenaPage({ params }: { params: Promise<{ arenaId: string }> }) {
    const { arenaId } = await params

    try {
        await assertArenaAccess(arenaId)
    } catch {
        redirect('/dashboard/settings/arenas')
    }

    const [subscription, paymentHistory] = await Promise.all([
        getSubscription(arenaId),
        getPaymentHistory(arenaId)
    ])

    return (
        <SubscriptionPageClient
            arenaId={arenaId}
            initialSubscription={subscription}
            initialPaymentHistory={paymentHistory}
        />
    )
}
