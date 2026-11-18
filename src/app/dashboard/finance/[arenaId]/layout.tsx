import { redirect } from 'next/navigation'
import { assertArenaResourceAccess } from '@/lib/server-auth'
import { FinanceTabsNav } from '@/modules/finance/components/FinanceTabsNav'

export default async function FinanceLayout({
    children,
    params,
}: {
    children: React.ReactNode
    params: Promise<{ arenaId: string }>
}) {
    const { arenaId } = await params

    let access
    try {
        access = await assertArenaResourceAccess(arenaId, 'finance.overview', 'finance.cash', 'finance.settings')
    } catch {
        redirect('/dashboard/settings/arenas')
    }

    return (
        <div className="space-y-6">
            <FinanceTabsNav arenaId={arenaId} resources={access.resources} />
            {children}
        </div>
    )
}
