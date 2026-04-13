"use server"

import { revalidatePath } from 'next/cache'
import { assertArenaAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export async function deleteArenaAction(arenaId: string): Promise<{ success: boolean; error?: string }> {
    try {
        await assertArenaAccess(arenaId)
        const supabase = getSupabaseAdmin()
        const { error } = await supabase.from('arenas').delete().eq('id', arenaId)
        if (error) throw new Error(error.message)
        revalidatePath('/dashboard/settings/arenas')
        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao excluir arena'
        console.error('[deleteArenaAction]', message)
        return { success: false, error: message }
    }
}
