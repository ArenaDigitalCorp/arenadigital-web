import { redirect } from 'next/navigation'
import { assertArenaAdminAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { SupabaseFinanceRepository } from '@/modules/finance/repositories/SupabaseFinanceRepository'
import { format } from 'date-fns'
import { FinanceDashboardClient } from '@/modules/finance/components/FinanceDashboardClient'
import { buildTutorialFinance } from '@/lib/tutorial-mock-data'

export default async function FinanceDashboard({
    params,
    searchParams,
}: {
    params: Promise<{ arenaId: string }>
    searchParams: Promise<{ tutorial?: string }>
}) {
    const { arenaId } = await params
    const { tutorial } = await searchParams

    try {
        await assertArenaAdminAccess(arenaId)
    } catch {
        redirect('/dashboard/settings/arenas')
    }

    if (tutorial === '1') {
        const finance = buildTutorialFinance(arenaId)
        return (
            <FinanceDashboardClient
                arenaId={arenaId}
                initialSummary={finance.summary}
                initialRecentEntradas={finance.recentEntradas}
                initialRecentSaidas={finance.recentSaidas}
                initialChartSeries={finance.chartSeries}
            />
        )
    }

    const repo = new SupabaseFinanceRepository(getSupabaseAdmin())

    const now = new Date()
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const start = new Date(end)
    start.setDate(start.getDate() - 29)

    const [summary, recentEntradas, recentSaidas, chartSeries] = await Promise.all([
        repo.getSummary(arenaId),
        repo.findRecent(arenaId, 'entrada', 4),
        repo.findRecent(arenaId, 'saída', 4),
        repo.getDailyTotals(arenaId, format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd')),
    ])

    return (
        <FinanceDashboardClient
            arenaId={arenaId}
            initialSummary={summary}
            initialRecentEntradas={recentEntradas}
            initialRecentSaidas={recentSaidas}
            initialChartSeries={chartSeries}
        />
    )
}
