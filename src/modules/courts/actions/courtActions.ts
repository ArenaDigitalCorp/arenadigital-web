"use server"

import { getSupabaseAdmin } from '@/lib/supabase-server'
import { assertArenaAccess } from '@/lib/server-auth'
import { revalidatePath } from 'next/cache'

export async function getCourtsByArenaAction(arenaId: string) {
    try {
        await assertArenaAccess(arenaId)
        const supabase = getSupabaseAdmin()
        const { data, error } = await supabase
            .from('courts')
            .select(`*, sports:court_sports(sport:sports(*))`)
            .eq('arena_id', arenaId)
            .order('created_at', { ascending: false })

        if (error) throw new Error(error.message)

        return {
            success: true,
            data: data.map(court => ({
                ...court,
                sports: (court.sports as any[]).map(s => s.sport)
            }))
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar espaços'
        return { success: false, error: message, data: [] }
    }
}

export async function deleteCourtAction(arenaId: string, courtId: string) {
    try {
        await assertArenaAccess(arenaId)
        const { error } = await getSupabaseAdmin()
            .from('courts')
            .delete()
            .eq('id', courtId)

        if (error) throw new Error(error.message)
        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao excluir espaço'
        return { success: false, error: message }
    }
}

export async function getCourtByIdAction(arenaId: string, courtId: string) {
    try {
        await assertArenaAccess(arenaId)
        const { data, error } = await getSupabaseAdmin()
            .from('courts')
            .select(`*, sports:court_sports(sport:sports(*))`)
            .eq('id', courtId)
            .single()

        if (error) throw new Error(error.message)

        return {
            success: true,
            data: { ...data, sports: (data.sports as any[]).map(s => s.sport) }
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar espaço'
        return { success: false, error: message, data: null }
    }
}

export async function createCourtAction(arenaId: string, input: Record<string, any>, sportIds?: string[]) {
    try {
        await assertArenaAccess(arenaId)
        const supabase = getSupabaseAdmin()

        const { data: court, error } = await supabase
            .from('courts')
            .insert([{ ...input, arena_id: arenaId }])
            .select()
            .single()

        if (error) throw new Error(error.message)

        if (sportIds && sportIds.length > 0) {
            await supabase.from('court_sports').insert(sportIds.map(id => ({ court_id: court.id, sport_id: id })))
        }

        revalidatePath(`/dashboard/arenas/${arenaId}`)
        return { success: true, data: court }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao criar espaço'
        return { success: false, error: message, data: null }
    }
}

export async function updateCourtAction(arenaId: string, courtId: string, input: Record<string, any>, sportIds?: string[]) {
    try {
        await assertArenaAccess(arenaId)
        const supabase = getSupabaseAdmin()

        const { data: court, error } = await supabase
            .from('courts')
            .update(input)
            .eq('id', courtId)
            .select()
            .single()

        if (error) throw new Error(error.message)

        if (sportIds) {
            await supabase.from('court_sports').delete().eq('court_id', courtId)
            if (sportIds.length > 0) {
                await supabase.from('court_sports').insert(sportIds.map(id => ({ court_id: courtId, sport_id: id })))
            }
        }

        revalidatePath(`/dashboard/arenas/${arenaId}`)
        return { success: true, data: court }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao atualizar espaço'
        return { success: false, error: message, data: null }
    }
}
