import { redirect } from 'next/navigation'
import { assertArenaBackofficeAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { SupabaseArenaRepository } from '@/modules/arenas/repositories/SupabaseArenaRepository'
import { SupabaseLoyaltyRepository } from '@/modules/loyalty/repositories/SupabaseLoyaltyRepository'
import { LoyaltyDashboardClient } from './LoyaltyDashboardClient'

export default async function FidelityPage({ params }: { params: Promise<{ arenaId: string }> }) {
    const { arenaId } = await params

    try {
        await assertArenaBackofficeAccess(arenaId)
    } catch {
        redirect('/dashboard/settings/arenas')
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
