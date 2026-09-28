import { assertArenaBackofficeAccess } from '@/lib/server-auth'
import { redirect } from 'next/navigation'
import { getAvulsosTodosAction, getModoPagamentoAction } from '@/modules/finance/actions/financeActions'
import { AvulsasPageClient } from '@/modules/finance/components/AvulsasPageClient'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function AvulsasPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>
    searchParams: Promise<{ booking?: string }>
}) {
    const { id: arenaId } = await params
    const { booking } = await searchParams

    try {
        await assertArenaBackofficeAccess(arenaId)
    } catch {
        redirect('/dashboard/settings/arenas')
    }

    const [result, modos] = await Promise.all([
        getAvulsosTodosAction(arenaId),
        getModoPagamentoAction(),
    ])

    return (
        <AvulsasPageClient
            arenaId={arenaId}
            initialItems={result.data ?? []}
            modosPagamento={modos.data ?? []}
            initialBookingId={booking && UUID_RE.test(booking) ? booking : null}
        />
    )
}
