"use server"

import { revalidatePath } from 'next/cache'
import { assertArenaBackofficeAccess, requireAuthenticatedDbUser } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { SupabaseArenaRepository } from '@/modules/arenas/repositories/SupabaseArenaRepository'
import type { CreateArenaDTO, UpdateArenaDTO } from '@/modules/arenas/types/arena.types'

export async function deleteArenaAction(arenaId: string): Promise<{ success: boolean; error?: string }> {
    try {
        await assertArenaBackofficeAccess(arenaId)
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

export async function getArenaByIdAction(arenaId: string) {
    try {
        await assertArenaBackofficeAccess(arenaId)
        const arena = await new SupabaseArenaRepository(getSupabaseAdmin()).findById(arenaId)
        return { success: true, data: arena }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar arena'
        return { success: false, error: message, data: null }
    }
}

export async function createArenaAction(input: CreateArenaDTO) {
    try {
        const { dbUserId } = await requireAuthenticatedDbUser()
        const arena = await new SupabaseArenaRepository(getSupabaseAdmin()).create({ ...input, owner_id: dbUserId })
        revalidatePath('/dashboard/settings/arenas')
        return { success: true, data: arena }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao criar arena'
        return { success: false, error: message, data: null }
    }
}

export async function getComodidadesAction() {
    try {
        const { data, error } = await getSupabaseAdmin().from('comodidades').select('*').order('name')
        if (error) throw new Error(error.message)
        return { success: true, data: data ?? [] }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar comodidades'
        return { success: false, error: message, data: [] }
    }
}

export async function getEstadosAction() {
    try {
        const { data, error } = await getSupabaseAdmin().from('estados').select('*').order('nome')
        if (error) throw new Error(error.message)
        return { success: true, data: data ?? [] }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar estados'
        return { success: false, error: message, data: [] }
    }
}

export async function getMunicipiosByEstadoAction(codigoUf: number) {
    try {
        const { data, error } = await getSupabaseAdmin()
            .from('municipios').select('*').eq('codigo_uf', codigoUf).order('nome')
        if (error) throw new Error(error.message)
        return { success: true, data: data ?? [] }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar municípios'
        return { success: false, error: message, data: [] }
    }
}

export async function getMunicipioByIbgeAction(codigoIbge: number) {
    try {
        const { data, error } = await getSupabaseAdmin()
            .from('municipios').select('*').eq('codigo_ibge', codigoIbge).single()
        if (error) throw new Error(error.message)
        return { success: true, data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar município'
        return { success: false, error: message, data: null }
    }
}

export async function updateArenaAction(arenaId: string, input: UpdateArenaDTO) {
    try {
        await assertArenaBackofficeAccess(arenaId)
        const arena = await new SupabaseArenaRepository(getSupabaseAdmin()).update(arenaId, input)
        revalidatePath(`/dashboard/arenas/${arenaId}/edit`)
        revalidatePath('/dashboard/settings/arenas')
        return { success: true, data: arena }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao atualizar arena'
        return { success: false, error: message, data: null }
    }
}
