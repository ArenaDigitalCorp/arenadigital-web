'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ARENA_TERMS_VERSION } from './arena-terms'

export type ArenaTermsReceipt = { version: string; accepted_at: string }
export type ArenaTermsStatus = {
    version: string
    is_owner: boolean
    accepted_at: string | null
    receipts: ArenaTermsReceipt[]
}

type RpcClient = {
    rpc(name: 'get_arena_terms_status' | 'accept_arena_terms', args: { p_arena_id: string; p_version?: string }):
        Promise<{ data: ArenaTermsStatus | null; error: { code?: string } | null }>
}

export async function getArenaTermsStatus(arenaId: string): Promise<ArenaTermsStatus> {
    const client = await createSupabaseServerClient() as unknown as RpcClient
    const { data, error } = await client.rpc('get_arena_terms_status', { p_arena_id: arenaId })
    if (error || !data) throw new Error('Não foi possível consultar o aceite dos termos.')
    return data
}

export async function acceptArenaTerms(arenaId: string, version: string, confirmed: boolean) {
    if (confirmed !== true || version !== ARENA_TERMS_VERSION) {
        return { error: 'Revise a versão atual dos termos antes de aceitar.' }
    }
    const client = await createSupabaseServerClient() as unknown as RpcClient
    const { data, error } = await client.rpc('accept_arena_terms', { p_arena_id: arenaId, p_version: version })
    if (error || !data?.accepted_at) {
        return { error: 'O aceite não foi registrado. Confira se você é o titular da arena e se a versão está atualizada.' }
    }
    return { data }
}
