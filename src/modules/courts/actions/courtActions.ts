"use server"

import { getSupabaseAdmin } from '@/lib/supabase-server'
import { assertArenaAdminAccess, assertCourtAccess } from '@/lib/server-auth'
import { assertCanCreateSpaceForArena } from '@/modules/payments/usecases/assert-space-entitlement.usecase'
import type { Database } from '@/types/supabase.types'
import {
    normalizeCourtSports,
    type CourtWithSportRelations,
} from '@/modules/courts/utils/normalize-court-sports'
import { revalidatePath } from 'next/cache'

type CourtInsert = Database['public']['Tables']['courts']['Insert']
type CourtUpdate = Database['public']['Tables']['courts']['Update']
type CourtCreateInput = Omit<CourtInsert, 'arena_id'>

type CourtRowWithSports = CourtWithSportRelations & Record<string, unknown>

export async function getSportsForCourtAction(): Promise<{ success: boolean; data: { id: string; name: string }[]; error?: string }> {
    try {
        const supabase = getSupabaseAdmin()
        const { data, error } = await supabase
            .from('sports')
            .select('id, name')
            .order('name')

        if (error) throw new Error(error.message)
        return { success: true, data: data ?? [] }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar esportes'
        console.error('[getSportsForCourtAction]', message)
        return { success: false, error: message, data: [] }
    }
}

export async function getCourtsByArenaAction(arenaId: string) {
    try {
        await assertArenaAdminAccess(arenaId)
        const supabase = getSupabaseAdmin()
        const { data, error } = await supabase
            .from('courts')
            .select(`*, sports:court_sports(sport:sports(*))`)
            .eq('arena_id', arenaId)
            .order('created_at', { ascending: false })

        if (error) throw new Error(error.message)

        return {
            success: true,
            data: (data as CourtRowWithSports[]).map((court) => normalizeCourtSports(court))
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar espaços'
        return { success: false, error: message, data: [] }
    }
}

export async function deleteCourtAction(arenaId: string, courtId: string) {
    try {
        await assertArenaAdminAccess(arenaId)
        await assertCourtAccess(courtId, arenaId)
        const { error } = await getSupabaseAdmin()
            .from('courts')
            .delete()
            .eq('id', courtId)
            .eq('arena_id', arenaId)

        if (error) throw new Error(error.message)
        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao excluir espaço'
        return { success: false, error: message }
    }
}

export async function getCourtByIdAction(arenaId: string, courtId: string) {
    try {
        await assertCourtAccess(courtId, arenaId)
        const { data, error } = await getSupabaseAdmin()
            .from('courts')
            .select(`*, sports:court_sports(sport:sports(*))`)
            .eq('id', courtId)
            .eq('arena_id', arenaId)
            .single()

        if (error) throw new Error(error.message)

        return { success: true, data: normalizeCourtSports(data as CourtRowWithSports) }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar espaço'
        return { success: false, error: message, data: null }
    }
}

export async function createCourtAction(arenaId: string, input: CourtCreateInput, sportIds?: string[]) {
    try {
        await assertArenaAdminAccess(arenaId)
        await assertCanCreateSpaceForArena(arenaId)
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

export async function duplicateCourtAction(arenaId: string, courtId: string, newName: string) {
    try {
        await assertArenaAdminAccess(arenaId)
        await assertCourtAccess(courtId, arenaId)
        await assertCanCreateSpaceForArena(arenaId)
        const supabase = getSupabaseAdmin()

        const trimmedName = newName.trim()
        if (!trimmedName) throw new Error('Informe um nome para o novo espaço.')

        const { data: original, error: fetchError } = await supabase
            .from('courts')
            .select(`*, sports:court_sports(sport:sports(*))`)
            .eq('id', courtId)
            .eq('arena_id', arenaId)
            .single()

        if (fetchError) throw new Error(fetchError.message)

        const {
            id: _id,
            created_at: _createdAt,
            arena_id: _arenaId,
            name: _name,
            sports,
            ...rest
        } = original as CourtRowWithSports

        const sportIds = (sports ?? []).flatMap((relation) =>
            relation.sport ? [relation.sport.id] : []
        )

        const { data: court, error } = await supabase
            .from('courts')
            .insert([{ ...(rest as CourtCreateInput), name: trimmedName, arena_id: arenaId }])
            .select()
            .single()

        if (error) throw new Error(error.message)

        if (sportIds.length > 0) {
            await supabase
                .from('court_sports')
                .insert(sportIds.map((id) => ({ court_id: court.id, sport_id: id })))
        }

        const { data: full } = await supabase
            .from('courts')
            .select(`*, sports:court_sports(sport:sports(*))`)
            .eq('id', court.id)
            .single()

        revalidatePath(`/dashboard/arenas/${arenaId}`)
        return { success: true, data: normalizeCourtSports((full ?? court) as CourtRowWithSports) }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao copiar espaço'
        return { success: false, error: message, data: null }
    }
}

export async function updateCourtAction(arenaId: string, courtId: string, input: CourtUpdate, sportIds?: string[]) {
    try {
        await assertArenaAdminAccess(arenaId)
        await assertCourtAccess(courtId, arenaId)
        const supabase = getSupabaseAdmin()

        const { data: court, error } = await supabase
            .from('courts')
            .update(input)
            .eq('id', courtId)
            .eq('arena_id', arenaId)
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
