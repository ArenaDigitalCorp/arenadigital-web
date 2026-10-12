import { redirect } from 'next/navigation'
import { assertArenaAccess } from '@/lib/server-auth'
import { FinanceTabsNav } from '@/modules/finance/components/FinanceTabsNav'

export default async function FinanceLayout({
    children,
    params,
}: {
    children: React.ReactNode
    params: Promise<{ arenaId: string }>
}) {
    const { arenaId } = await params

    try {
        await assertArenaAccess(arenaId)
    } catch {
        redirect('/dashboard/settings/arenas')
    }

    return (
        <div className="space-y-6">
            <FinanceTabsNav arenaId={arenaId} />
            {children}
        </div>
    )
}
