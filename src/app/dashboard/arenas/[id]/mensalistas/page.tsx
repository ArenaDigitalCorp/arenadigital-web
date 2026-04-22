import { assertArenaBackofficeAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { MensalistasPageClient } from './MensalistasPageClient'
import type { PlanoMensalistaComDetalhes } from '@/modules/bookings/types/booking.types'

export default async function MensalistasPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: arenaId } = await params

    try {
        await assertArenaBackofficeAccess(arenaId)
    } catch {
        redirect('/dashboard/settings/arenas')
    }

    const supabase = getSupabaseAdmin()
    const now = new Date().toISOString()

    const { data: planos } = await supabase
        .from('planos_mensalista')
        .select('*, atleta:athlete_id(id, nome_perfil, telefone), sports:sport_id(id, name), court:court_id(id, name)')
        .eq('arena_id', arenaId)
        .order('created_at', { ascending: false })

    const planosWithNext: PlanoMensalistaComDetalhes[] = await Promise.all(
        (planos ?? []).map(async (plano: any) => {
            const { data: nextReservado } = await supabase
                .from('bookings')
                .select('start_time')
                .eq('plano_mensalista_id', plano.id)
                .eq('status', 'reservado')
                .gte('start_time', now)
                .order('start_time', { ascending: true })
                .limit(1)

            return {
                ...plano,
                proximo_mes_reservado: nextReservado?.[0]?.start_time ?? null,
            } as PlanoMensalistaComDetalhes
        })
    )

    return <MensalistasPageClient arenaId={arenaId} initialPlanos={planosWithNext} />
}
