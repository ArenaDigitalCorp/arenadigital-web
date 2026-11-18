import { redirect } from 'next/navigation'
import { assertArenaResourceAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { getAgentSettingsAction } from '@/modules/ai-agent/actions/agentActions'
import { ArenaAiAgentSettingsCard } from '@/modules/ai-agent/components/ArenaAiAgentSettingsCard'

export default async function SettingsWhatsappPage({
    params,
}: {
    params: Promise<{ arenaId: string }>
}) {
    const { arenaId } = await params

    try {
        await assertArenaResourceAccess(arenaId, 'settings.whatsapp')
    } catch {
        redirect('/dashboard/settings/arenas')
    }

    const supabase = getSupabaseAdmin()
    const [arenaResult, agentSettings] = await Promise.all([
        supabase.from('arenas').select('id, name').eq('id', arenaId).single(),
        getAgentSettingsAction(arenaId),
    ])

    if (arenaResult.error || !arenaResult.data) {
        redirect('/dashboard/settings/arenas')
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">WhatsApp</h2>
                <p className="text-muted-foreground">
                    Agente de IA no WhatsApp da arena {arenaResult.data.name}.
                </p>
            </div>
            <ArenaAiAgentSettingsCard arenaId={arenaId} initialSettings={agentSettings.data} />
        </div>
    )
}
