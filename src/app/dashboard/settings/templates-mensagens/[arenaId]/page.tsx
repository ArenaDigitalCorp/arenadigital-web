import { redirect } from 'next/navigation'
import { assertArenaAdminAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { TemplatesMensagensPageClient } from '@/modules/templates-mensagens/components/TemplatesMensagensPageClient'
import { getMessageTemplatesByArenaAction } from '@/modules/templates-mensagens/actions/templateMensagemActions'

export default async function SettingsTemplatesMensagensPage({
    params,
}: {
    params: Promise<{ arenaId: string }>
}) {
    const { arenaId } = await params

    try {
        await assertArenaAdminAccess(arenaId)
    } catch {
        redirect('/dashboard/settings/arenas')
    }

    const supabase = getSupabaseAdmin()
    const [{ data: arena, error }, templatesResult] = await Promise.all([
        supabase.from('arenas').select('id, name').eq('id', arenaId).single(),
        getMessageTemplatesByArenaAction(arenaId),
    ])

    if (error || !arena) {
        redirect('/dashboard/settings/arenas')
    }

    return (
        <TemplatesMensagensPageClient
            arenaId={arenaId}
            arenaName={arena.name ?? ''}
            initialTemplates={templatesResult.data ?? []}
        />
    )
}
