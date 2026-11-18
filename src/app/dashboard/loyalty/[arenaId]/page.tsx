import { redirect } from 'next/navigation'
import { assertArenaResourceAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { SupabaseArenaRepository } from '@/modules/arenas/repositories/SupabaseArenaRepository'
import { SupabaseLoyaltyRepository } from '@/modules/loyalty/repositories/SupabaseLoyaltyRepository'
import { LoyaltyDashboardClient } from '@/modules/loyalty/components/LoyaltyDashboardClient'
import { buildTutorialLoyalty } from '@/lib/tutorial-mock-data'

export default async function FidelityPage({
    params,
    searchParams,
}: {
    params: Promise<{ arenaId: string }>
    searchParams: Promise<{ tutorial?: string }>
}) {
    const { arenaId } = await params
    const { tutorial } = await searchParams

    try {
        await assertArenaResourceAccess(arenaId, 'loyalty')
    } catch {
        redirect('/dashboard/settings/arenas')
    }

    if (tutorial === '1') {
        const loyalty = buildTutorialLoyalty(arenaId)
        return (
            <LoyaltyDashboardClient
                arenaId={arenaId}
                initialCurrencyName="Arena Coins"
                initialCredits={loyalty.credits}
                initialRedemptions={loyalty.redemptions}
                initialTopAthletes={loyalty.topAthletes}
            />
        )
    }

    const admin = getSupabaseAdmin()
    const arenaRepo = new SupabaseArenaRepository(admin)
    const loyaltyRepo = new SupabaseLoyaltyRepository(admin)

    const [arena, credits, redemptions, topAthletes] = await Promise.all([
        arenaRepo.findById(arenaId),
        loyaltyRepo.findRecent(arenaId, 'crédito', 5),
        loyaltyRepo.findRecentRedemptions(arenaId, 5),
        loyaltyRepo.getTopAthletes(arenaId, 5),
    ])

    return (
        <LoyaltyDashboardClient
            arenaId={arenaId}
            initialCurrencyName={arena?.nome_moeda_virtual ?? ''}
            initialCredits={credits}
            initialRedemptions={redemptions}
            initialTopAthletes={topAthletes}
        />
    )
}
